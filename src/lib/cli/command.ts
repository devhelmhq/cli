/**
 * Base class for every command added with the synthetics surfaces
 * (doc 42 §6.1). It owns the behaviour every such command shares:
 *
 *   - output: `-o json|yaml|table`; without `-o` and without a TTY the
 *     format is `json` (`DEVHELM_OUTPUT` overrides). In JSON mode exactly
 *     one document goes to stdout:
 *       { ok, exit, data | error, warnings[], skipped[], meta, …extra }
 *     Progress goes to stderr.
 *   - the header line `<org> · workspace <ws> · <plan>` (human output),
 *     from `/auth/me` + `/entitlements`, cached per invocation;
 *   - non-interactive rules: `CI=true`, `DEVHELM_NON_INTERACTIVE=1` or no
 *     TTY never prompts; gated writes exit 15 with `changes[]` and
 *     `confirmCommand`;
 *   - the central error handler: every `DevhelmError` maps to its D-2 exit
 *     code through its category; exit 1 is never used for a classified
 *     error;
 *   - SIGINT/SIGTERM: runs this invocation queued are cancelled, exit 130.
 */
import {promptYesNo} from './prompt.js'
import {createHash} from 'node:crypto'
import {Command, Errors, Flags, type Interfaces} from '@oclif/core'
import {stringify as yamlStringify} from 'yaml'
import {beginInvocation, createApiClient, type ApiClient} from '../api-client.js'
import {getCurrentContext, resolveApiUrl} from '../auth.js'
import {
  ConfirmationRequiredError,
  DevhelmError,
  EXIT_CODES,
  ValidationError,
  CliExitError,
  exitCodeOf,
  noTokenError,
  type ErrorCategory,
  type JsonValue,
} from '../errors.js'
import {urlFlag} from '../validators.js'
import {cancelStartedRuns} from '../runs/registry.js'
import {fetchMeta, type Meta} from './meta.js'

export type OutputFormat = 'json' | 'yaml' | 'table'

export interface SkippedEntry {
  target: string
  reason: string
  code?: string
}

/** Flags shared by every command (§6.1 "Global flags"). */
export const commonFlags = {
  output: Flags.string({
    char: 'o',
    description: 'Output format (default: table on a terminal, json otherwise; DEVHELM_OUTPUT overrides)',
    options: ['json', 'yaml', 'table'],
  }),
  verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  'api-url': urlFlag({description: 'Override API base URL'}),
  'api-token': Flags.string({description: 'Override API token'}),
  org: Flags.string({description: 'Organization id or name to pin (also DEVHELM_ORG_ID)'}),
  workspace: Flags.string({description: 'Workspace id or name to pin (also DEVHELM_WORKSPACE_ID)'}),
  'idempotency-key': Flags.string({description: 'Idempotency-Key for the first write of this invocation'}),
}

export const yesFlag = {
  yes: Flags.boolean({char: 'y', description: 'Confirm non-public gated writes without a prompt', default: false}),
}

export type CommonFlags = Interfaces.InferredFlags<typeof commonFlags>

/** True when the CLI must never prompt (CI, explicit opt-out, or no TTY). */
export function isNonInteractive(): boolean {
  if ((process.env.CI ?? '').toLowerCase() === 'true') return true
  if (process.env.DEVHELM_NON_INTERACTIVE === '1') return true
  return !process.stdin.isTTY || !process.stdout.isTTY
}

/**
 * Whether pre-1.12 commands also print the `{ok, exit, data, …}` wrapper
 * and default to JSON without a TTY. Opt-in now; the default from the
 * 2027-01-31 major release.
 */
export function envelopeEverywhere(): boolean {
  return process.env.DEVHELM_JSON_ENVELOPE === '1'
}

/**
 * Resolve the output format: `-o`, then `DEVHELM_OUTPUT`, then TTY → table,
 * else json. Pre-1.12 commands (`legacy`) keep `table` as their non-TTY
 * default unless `DEVHELM_JSON_ENVELOPE=1`.
 */
export function resolveFormat(flag: string | undefined, legacy = false): OutputFormat {
  const pick = (v: string | undefined): OutputFormat | undefined =>
    v === 'json' || v === 'yaml' || v === 'table' ? v : v === 'text' ? 'table' : undefined
  const fallback: OutputFormat = process.stdout.isTTY || (legacy && !envelopeEverywhere()) ? 'table' : 'json'
  return pick(flag) ?? pick(process.env.DEVHELM_OUTPUT) ?? fallback
}

/** Stable confirmation token over an exact change list (`cft_…`). */
export function confirmationToken(action: string, changes: JsonValue): string {
  return 'cft_' + createHash('sha256').update(`${action}\n${canonicalJson(changes)}`).digest('hex').slice(0, 20)
}

export interface FinishOptions {
  exit?: number
  data?: unknown
  /** Extra top-level wrapper keys, e.g. `landed[]`, `notLanded[]`, `failures[]`. */
  extra?: Record<string, unknown>
  /** Human rendering for table mode. */
  human?: () => void
  /**
   * Pre-1.12 project commands (validate, plan, deploy): keep their own
   * document and add the wrapper keys to it, instead of the bare document.
   */
  legacyMergeWrapper?: boolean
}

export abstract class DevhelmCommand extends Command {
  /**
   * Set on commands that existed before 1.12. Their JSON/YAML output stays
   * the bare document (no wrapper), errors stay on stderr, and their
   * non-TTY default stays `table`, until the 2027-01-31 major release;
   * `DEVHELM_JSON_ENVELOPE=1` switches them to the wrapper now.
   */
  static legacyOutput = false

  protected format: OutputFormat = 'table'
  protected warnings: string[] = []
  protected skipped: SkippedEntry[] = []
  protected meta: Meta | undefined
  protected commonFlagValues: Partial<CommonFlags> = {}
  private apiClient: ApiClient | undefined
  private signalHandler: (() => void) | undefined

  public async init(): Promise<void> {
    await super.init()
    const {flags} = await this.parse(this.constructor as Command.Class)
    this.commonFlagValues = flags as Partial<CommonFlags>
    this.format = resolveFormat(this.commonFlagValues.output, this.legacy)
    beginInvocation(this.id ?? 'cli', this.commonFlagValues['idempotency-key'])
    this.signalHandler = () => {
      void cancelStartedRuns().finally(() => {
        this.emitError(new CliExitError('Interrupted; queued runs started by this command were cancelled', 'platform', EXIT_CODES.INTERRUPTED, {code: 'INTERRUPTED'}))
        process.exit(EXIT_CODES.INTERRUPTED)
      })
    }
    process.once('SIGINT', this.signalHandler)
    process.once('SIGTERM', this.signalHandler)
  }

  protected async finally(err: Error | undefined): Promise<void> {
    if (this.signalHandler) {
      process.removeListener('SIGINT', this.signalHandler)
      process.removeListener('SIGTERM', this.signalHandler)
    }
    await super.finally(err)
  }

  /** Pre-1.12 output contract in effect for this invocation. */
  get legacy(): boolean {
    return (this.constructor as typeof DevhelmCommand).legacyOutput && !envelopeEverywhere()
  }

  get structured(): boolean {
    return this.format !== 'table'
  }

  get nonInteractive(): boolean {
    return isNonInteractive()
  }

  /** Progress and diagnostics: stderr, so JSON stdout stays one document. */
  protected progress(message: string): void {
    process.stderr.write(`${message}\n`)
  }

  /** Human output (table mode only). */
  protected human(message = ''): void {
    if (!this.structured) this.log(message)
  }

  protected addWarning(message: string): void {
    this.warnings.push(message)
    if (!this.structured) this.logToStderr(`! ${message}`)
  }

  /** The API client, built once from flags, env and context (§5.2). */
  protected client(): ApiClient {
    if (this.apiClient) return this.apiClient
    const f = this.commonFlagValues
    const ctx = getCurrentContext()
    const envToken = process.env.DEVHELM_API_TOKEN
    const token = f['api-token'] || envToken || ctx?.token
    if (!token) throw noTokenError()
    if (!f['api-token'] && envToken && ctx && ctx.token !== envToken && !this.structured) {
      this.logToStderr(`token from DEVHELM_API_TOKEN overrides context "${ctx.name}"`)
    }
    const orgId = numericOrUndefined(f.org) ?? numericOrUndefined(process.env.DEVHELM_ORG_ID) ?? ctx?.orgId
    const workspaceId = numericOrUndefined(f.workspace) ?? numericOrUndefined(process.env.DEVHELM_WORKSPACE_ID) ?? ctx?.workspaceId
    this.apiClient = createApiClient({
      baseUrl: f['api-url'] || resolveApiUrl(),
      token,
      orgId: orgId !== undefined ? String(orgId) : undefined,
      workspaceId: workspaceId !== undefined ? String(workspaceId) : undefined,
      verbose: f.verbose,
    })
    return this.apiClient
  }

  /**
   * `meta{org, workspace, plan}` for the wrapper and the human header line.
   * Fetched once. A name pin (`--org acme`, `org:` in devhelm.yml) that does
   * not match the key's organization is a validation error (D-11).
   */
  protected async loadMeta(pins: {org?: string; workspace?: string} = {}): Promise<Meta> {
    if (!this.meta) this.meta = await fetchMeta(this.client())
    const orgPin = pins.org ?? nonNumeric(this.commonFlagValues.org)
    if (orgPin && !this.meta.org) {
      throw new ValidationError(`This command is pinned to organization "${orgPin}", but the token's organization cannot be read (/auth/me); use an API key`, {code: 'ORG_UNVERIFIED'})
    }
    if (orgPin && this.meta.org && !sameName(orgPin, this.meta.org.name) && String(this.meta.org.id) !== orgPin) {
      throw new ValidationError(
        `This command is pinned to organization "${orgPin}", but the token belongs to "${this.meta.org.name}" (id ${this.meta.org.id})`,
        {code: 'ORG_MISMATCH', next: {command: 'devhelm auth switch <context>', docs: null}},
      )
    }
    const wsPin = pins.workspace ?? nonNumeric(this.commonFlagValues.workspace)
    if (wsPin && this.meta.workspace && !sameName(wsPin, this.meta.workspace.name) && String(this.meta.workspace.id) !== wsPin) {
      throw new ValidationError(
        `This command is pinned to workspace "${wsPin}", but requests go to "${this.meta.workspace.name}" (id ${this.meta.workspace.id})`,
        {code: 'WORKSPACE_MISMATCH', next: {command: 'devhelm --workspace <id> …', docs: null}},
      )
    }
    return this.meta
  }

  /** Print the header line in human mode. */
  protected async header(extra: string[] = [], pins: {org?: string; workspace?: string} = {}): Promise<void> {
    const meta = await this.loadMeta(pins)
    if (this.structured) return
    const parts = [meta.org?.name ?? 'unknown org', `workspace ${meta.workspace?.name ?? meta.workspace?.id ?? 'default'}`, meta.plan ?? 'unknown plan', ...extra]
    this.log(parts.join(' · '))
  }

  /**
   * Gate a write. Interactive: prompt. `--yes` satisfies non-public gates.
   * Otherwise exit 15 with `changes[]` and `confirmCommand` (D-4).
   */
  protected async confirm(opts: {
    action: string
    changes: JsonValue[]
    confirmCommand: string
    yes?: boolean
    prompt?: string
  }): Promise<void> {
    if (opts.yes) return
    if (!this.nonInteractive && !this.structured) {
      if (await promptYesNo(`${opts.prompt ?? 'Apply these changes?'} (y/N) `)) return
      throw new CliExitError('Cancelled', 'confirmation_required', EXIT_CODES.CONFIRMATION_REQUIRED, {code: 'CANCELLED'})
    }
    throw new ConfirmationRequiredError(`Confirmation required: ${opts.action}. Re-run with the confirm command`, {
      code: 'CONFIRMATION_REQUIRED',
      next: {command: opts.confirmCommand, docs: null},
      details: {action: opts.action, changes: opts.changes, confirmCommand: opts.confirmCommand},
    })
  }

  /** Write the success (or non-zero result) document and exit. */
  protected async finish(opts: FinishOptions = {}): Promise<void> {
    const exit = opts.exit ?? 0
    if (this.structured && this.legacy && opts.legacyMergeWrapper && opts.data && typeof opts.data === 'object') {
      // Pre-1.12 project documents: their own top-level keys win, the wrapper keys are added.
      const doc: Record<string, unknown> = {ok: exit === 0, exit, warnings: this.warnings, skipped: this.skipped, meta: this.meta ?? null, ...opts.extra, ...(opts.data as Record<string, unknown>)}
      this.writeDoc(doc)
    } else if (this.structured && this.legacy) {
      const data = opts.data ?? null
      process.stdout.write(`${this.format === 'yaml' ? yamlStringify(data).trimEnd() : JSON.stringify(data, null, 2)}\n`)
    } else if (this.structured) {
      const doc: Record<string, unknown> = {
        ok: exit === 0,
        exit,
        data: opts.data ?? null,
        warnings: this.warnings,
        skipped: this.skipped,
        ...opts.extra,
      }
      if (this.meta) doc.meta = this.meta
      this.writeDoc(doc)
    } else {
      opts.human?.()
    }
    if (exit !== 0) this.exit(exit)
  }

  private writeDoc(doc: Record<string, unknown>): void {
    const text = this.format === 'yaml' ? yamlStringify(doc).trimEnd() : JSON.stringify(doc, null, 2)
    process.stdout.write(`${text}\n`)
  }

  /** Print an error in the active format (stdout document or stderr text). */
  protected emitError(err: DevhelmError): void {
    // Pre-1.12 commands keep the error text on stderr and, in JSON/YAML
    // mode, also get the error document on stdout (stdout was empty before).
    if (this.structured && this.legacy) {
      this.writeErrorDoc(err)
      this.writeErrorText(err)
      return
    }
    if (this.structured) {
      this.writeErrorDoc(err)
      return
    }
    this.writeErrorText(err)
  }

  private writeErrorDoc(err: DevhelmError): void {
    const doc: Record<string, unknown> = {
        ok: false,
        exit: exitCodeOf(err),
        error: err.toJSON(),
        warnings: this.warnings,
        skipped: this.skipped,
      }
      if (err instanceof ConfirmationRequiredError && err.details) {
        doc.changes = err.details.changes ?? []
        doc.confirmCommand = err.details.confirmCommand ?? null
      }
    if (this.meta) doc.meta = this.meta
    this.writeDoc(doc)
  }

  private writeErrorText(err: DevhelmError): void {
    const code = err.code ? `[${err.code}] ` : ''
    process.stderr.write(`✗ ${code}${err.message}\n`)
    for (const e of err.errors) process.stderr.write(`    ${e.field ? `${e.field}: ` : ''}${e.message}\n`)
    if (err instanceof ConfirmationRequiredError && err.details && Array.isArray(err.details.changes)) {
      for (const c of err.details.changes) process.stderr.write(`    ${typeof c === 'string' ? c : JSON.stringify(c)}\n`)
    }
    if (err.next?.command) process.stderr.write(`  next: ${err.next.command}\n`)
    if (err.requestId) process.stderr.write(`  request: ${err.requestId}\n`)
  }

  /** Central handler: classified errors exit through D-2, never 1. */
  protected async catch(err: Error & {exitCode?: number}): Promise<unknown> {
    if (err instanceof Errors.ExitError) throw err
    const classified = classify(err)
    if (!classified) throw err
    this.emitError(classified)
    const exit = exitCodeOf(classified)
    process.exitCode = exit
    throw new Errors.ExitError(exit)
  }
}

const EXIT_TO_CATEGORY: Record<number, ErrorCategory> = {
  4: 'validation', 11: 'platform', 12: 'transport', 15: 'confirmation_required', 16: 'plan',
  17: 'permission', 18: 'conflict', 20: 'gone',
}

/** Map anything a command throws onto a `DevhelmError`, or undefined for oclif's own errors. */
export function classify(err: Error): DevhelmError | undefined {
  if (err instanceof DevhelmError) return err
  const oclif = (err as {oclif?: {exit?: number}}).oclif
  if (oclif?.exit !== undefined) {
    // `this.error(msg, {exit})` and oclif parse errors (exit 2) keep their code.
    if (oclif.exit === EXIT_CODES.USAGE) return undefined
    const category = EXIT_TO_CATEGORY[oclif.exit] ?? 'validation'
    return new CliExitError(err.message, category, oclif.exit, {code: category === 'validation' ? 'INVALID_INPUT' : 'CLI_ERROR'})
  }
  if (err.name === 'ZodError') return new ValidationError(err.message, {code: 'INVALID_INPUT'})
  return undefined
}

/** JSON with object keys sorted, so equal values hash equally. */
export function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k] ?? null)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function numericOrUndefined(v: string | number | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

function nonNumeric(v: string | undefined): string | undefined {
  if (!v) return undefined
  return numericOrUndefined(v) === undefined ? v : undefined
}

function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return norm(a) === norm(b)
}
