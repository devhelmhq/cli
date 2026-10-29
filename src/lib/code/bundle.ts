/**
 * `code` input → uploaded bundle (doc 42 §5.3, doc 32 D-12).
 *
 * The import-closure resolver is `@devhelm/sdk/bundler`: one Node
 * implementation shared with the JS SDK, never copied here. This module
 * adapts it to the CLI: resolve the closure locally (relative imports,
 * tsconfig paths, the setup file, include globs; symlinks, dotfiles and
 * imports outside the set refused; bare imports checked against the
 * runtime catalog; 256 files / 5 MB), upload it to `POST /bundles`, and
 * check that the server's closure digest equals the local one
 * (`BUNDLE_DIGEST_MISMATCH` otherwise).
 */
import {
  RUNTIME_CATALOG,
  checkBundle,
  selectRuntime,
  type BundleFinding,
  type ResolvedBundle,
  type RuntimePackages,
} from '@devhelm/sdk/bundler'
import type {z} from 'zod'
import {apiGet, sdkClientFor, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {DevhelmError, ValidationError, type ErrorEntry, type JsonValue} from '../errors.js'
import {parse, parsePage} from '../response-validation.js'

export type BundleDto = z.infer<typeof apiSchemas.BundleDto>
export type MonitorCodeSpec = z.infer<typeof apiSchemas.MonitorCodeSpec>
export type RuntimeProfileDto = z.infer<typeof apiSchemas.RuntimeProfileDto>
export type {BundleFinding, RuntimePackages}

/** A path, or `{ entrypoint, include? }` (YAML / flags). */
export type CodeInput = string | {entrypoint: string; include?: string[]}

export interface CodeBundleOptions {
  /** Directory relative paths are resolved from (devhelm.yml's directory, or cwd). */
  baseDir: string
  /** Bundle root; default: nearest ancestor with `.git`, else `baseDir`. */
  root?: string
  /** Session setup file, relative to the entrypoint (default `auth.setup.ts` when present). */
  setupFile?: string
  /** Runtime to check imports against (a profile, or an id looked up in the catalog snapshot). */
  runtime?: RuntimePackages | null
  runtimeId?: string
}

export interface PreparedCode {
  root: string
  entrypoint: string
  files: Record<string, string | Uint8Array>
  fileList: string[]
  digest: string
  size: number
  keys: string[]
  warnings: BundleFinding[]
  resolved: ResolvedBundle
}

export interface CodeCheck {
  prepared: PreparedCode | null
  errors: BundleFinding[]
  warnings: BundleFinding[]
}

/** Runtime for the import check: an explicit profile, else the bundled catalog snapshot. */
export function runtimeFor(opts: Pick<CodeBundleOptions, 'runtime' | 'runtimeId'>): RuntimePackages | null {
  if (opts.runtime !== undefined) return opts.runtime
  return selectRuntime(RUNTIME_CATALOG, opts.runtimeId) ?? null
}

function toPrepared(b: ResolvedBundle, baseDir: string): PreparedCode {
  return {
    root: b.root ?? baseDir,
    entrypoint: b.entrypoint,
    files: b.files,
    fileList: b.fileList,
    digest: b.digest,
    size: b.size,
    keys: b.keys,
    warnings: b.warnings,
    resolved: b,
  }
}

/** Resolve and collect every finding (errors do not throw) — `validate` uses this. */
export async function checkCode(input: CodeInput, opts: CodeBundleOptions): Promise<CodeCheck> {
  const check = await checkBundle(input, {
    cwd: opts.baseDir,
    fallbackRoot: opts.baseDir,
    root: opts.root,
    setupFile: opts.setupFile,
    runtime: runtimeFor(opts),
  })
  return {
    prepared: check.bundle ? toPrepared(check.bundle, opts.baseDir) : null,
    errors: check.errors,
    warnings: check.warnings,
  }
}

/** One `ValidationError` carrying every error finding. */
export function bundleRefused(findings: BundleFinding[], label?: string): ValidationError {
  const first = findings[0]
  const more = findings.length > 1 ? ` (+${findings.length - 1} more)` : ''
  const errors: ErrorEntry[] = findings.map((f) => ({
    code: f.code,
    field: f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : null,
    message: f.message,
  }))
  const details: {[key: string]: JsonValue} = {}
  if (first?.file) details.file = first.file
  if (first?.line !== undefined) details.line = first.line
  if (first?.rule) details.rule = first.rule
  if (first?.import) details.import = first.import
  if (first?.suggestInclude) details.suggestInclude = first.suggestInclude
  return new ValidationError(`${label ? `${label}: ` : ''}${first?.message ?? 'bundle refused'}${more}`, {
    code: first?.code ?? 'BUNDLE_INVALID',
    errors,
    details,
  })
}

export async function prepareCode(input: CodeInput, opts: CodeBundleOptions): Promise<PreparedCode> {
  const check = await checkCode(input, opts)
  if (!check.prepared) throw bundleRefused(check.errors)
  return check.prepared
}

/** `code.source` from git / CI (advisory). */
export function codeSource(prepared: PreparedCode): MonitorCodeSpec['source'] {
  const s = prepared.resolved.source
  if (!s || (!s.repo && !s.branch && !s.commit && !s.file)) return undefined
  return {repo: s.repo, branch: s.branch, commit: s.commit, file: s.file}
}

/** Upload the closure through the SDK (JSON, or a zip when a file is binary; digest checked there). */
export async function uploadCode(client: ApiClient, prepared: PreparedCode, opts: {runtimeId?: string} = {}): Promise<{bundle: BundleDto; code: MonitorCodeSpec}> {
  const uploaded = await sdkClientFor(client).bundles.upload(prepared.resolved, {runtimeId: opts.runtimeId ?? null})
  const bundle = parse(apiSchemas.BundleDto, uploaded, 'POST /api/v1/bundles')
  const code: MonitorCodeSpec = {bundle: bundle.digest, entrypoint: prepared.entrypoint}
  const source = codeSource(prepared)
  if (source) code.source = source
  return {bundle, code}
}

/** `POST /bundles/check` through the SDK: every server finding, nothing stored (`validate --online`). */
export async function checkCodeOnline(client: ApiClient, prepared: PreparedCode, runtimeId?: string): Promise<z.infer<typeof apiSchemas.Finding>[]> {
  const result = await sdkClientFor(client).bundles.check(prepared.resolved, {runtimeId: runtimeId ?? null})
  return parse(apiSchemas.BundleCheckResultDto, result, 'POST /api/v1/bundles/check').findings
}

/** Convenience for `--code <file>`: prepare + upload, returning the `code` spec. */
export async function bundleCode(client: ApiClient, input: CodeInput, opts: CodeBundleOptions): Promise<{bundle: BundleDto; code: MonitorCodeSpec; prepared: PreparedCode}> {
  const prepared = await prepareCode(input, opts)
  const {bundle, code} = await uploadCode(client, prepared, {runtimeId: opts.runtimeId})
  return {bundle, code, prepared}
}

/** The live runtime catalog (`GET /synthetics/runtime-profiles`), or the bundled snapshot offline. */
export async function runtimeCatalog(client: ApiClient | undefined): Promise<RuntimePackages[]> {
  if (!client) return [...RUNTIME_CATALOG]
  try {
    const page = parsePage(apiSchemas.RuntimeProfileDto, await apiGet(client, '/api/v1/synthetics/runtime-profiles'), 'GET /api/v1/synthetics/runtime-profiles')
    if (page.data.length === 0) return [...RUNTIME_CATALOG]
    return page.data.map((p) => ({
      id: p.id,
      status: p.status,
      nodeVersion: p.nodeVersion,
      playwrightVersion: p.playwrightVersion,
      eolAt: p.eolAt ?? null,
      packages: p.packages ?? null,
      nodeBuiltins: p.nodeBuiltins ?? null,
      platformDefault: p.platformDefault,
    }))
  } catch (err) {
    if (err instanceof DevhelmError && err.category === 'transport') return [...RUNTIME_CATALOG]
    throw err
  }
}
