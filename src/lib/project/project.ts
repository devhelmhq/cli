/**
 * Loading a devhelm.yml project: parse every file, collect every problem
 * in one pass (schema, per-type rules, references, files, import closure,
 * runtime imports, literal secrets, ignored Playwright keys), and prepare
 * the code monitors' closures for plan / test / deploy.
 */
import {existsSync, readFileSync, statSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {checkCode, type CodeCheck, type RuntimePackages} from '../code/bundle.js'
import {selectRuntime} from '@devhelm/sdk/bundler'
import {loadConfig, ParseError, validate, type DevhelmConfig, type YamlMonitor} from '../yaml/index.js'
import {createProjectContext, type ProjectContext} from '../yaml/project-context.js'
import {isCodeMonitor} from '../yaml/transform.js'

export interface Issue {
  severity: 'error' | 'warning'
  path: string
  message: string
  code?: string
  file?: string
  line?: number
}

export interface LoadedProject {
  files: string[]
  configDir: string
  config: DevhelmConfig | null
  issues: Issue[]
  /** Project identity and the prepared code closures, keyed by monitor name. */
  ctx: ProjectContext
}

/** Directory relative `code:` paths resolve from: the (first) config file's directory. */
export function configDirOf(files: string[]): string {
  const first = resolve(files[0] ?? 'devhelm.yml')
  try {
    return statSync(first).isDirectory() ? first : dirname(first)
  } catch {
    return dirname(first)
  }
}

export function loadProject(files: string[], opts: {resolveEnv?: boolean} = {}): LoadedProject {
  const configDir = configDirOf(files)
  const issues: Issue[] = []
  let config: DevhelmConfig | null = null
  try {
    config = loadConfig(files, opts.resolveEnv ?? true)
  } catch (err) {
    if (err instanceof ParseError) {
      if (err.issues.length > 0) {
        for (const i of err.issues) issues.push({severity: 'error', path: i.path, message: i.message, code: 'CONFIG_INVALID', file: err.file})
      } else {
        issues.push({severity: 'error', path: '', message: err.message, code: 'CONFIG_INVALID', file: err.file})
      }
    } else {
      throw err
    }
  }
  if (config) {
    const result = validate(config)
    for (const e of result.errors) issues.push({severity: 'error', path: e.path, message: e.message, code: 'CONFIG_INVALID'})
    for (const w of result.warnings) issues.push({severity: 'warning', path: w.path, message: w.message})
  }
  return {files, configDir, config, issues, ctx: createProjectContext({project: config?.project, configDir})}
}

export function codeMonitors(config: DevhelmConfig | null): YamlMonitor[] {
  return (config?.monitors ?? []).filter((m) => isCodeMonitor(m))
}

/**
 * Resolve every code monitor's closure. Findings become issues; the
 * prepared closures are stored in the project context (keyed by monitor
 * name) for plan / test / deploy.
 */
export async function prepareCodeMonitors(
  loaded: LoadedProject,
  catalog: RuntimePackages[],
  only?: Set<string>,
): Promise<{issues: Issue[]; checks: Map<string, CodeCheck>}> {
  const issues: Issue[] = []
  const checks = new Map<string, CodeCheck>()
  const ctx = loaded.ctx
  const monitors = codeMonitors(loaded.config)
  for (const [i, m] of monitors.entries()) {
    if (only && !only.has(m.name)) continue
    if (m.code === undefined) continue
    const index = loaded.config?.monitors?.indexOf(m) ?? i
    const pin = (m.config as {runtimeId?: string | null} | undefined)?.runtimeId ?? undefined
    const runtime = selectRuntime(catalog, pin)
    if (pin && !runtime) {
      issues.push({severity: 'error', path: `monitors[${index}].config.runtimeId`, message: `Runtime "${pin}" is not in the runtime catalog (devhelm runtimes list)`, code: 'RUNTIME_UNKNOWN'})
    }
    const check = await checkCode(m.code, {
      baseDir: loaded.configDir,
      setupFile: m.session?.setupFile,
      runtime: runtime ?? null,
    })
    checks.set(m.name, check)
    for (const f of check.errors) {
      issues.push({severity: 'error', path: `monitors[${index}].code`, message: f.message, code: f.code, file: f.file, line: f.line})
    }
    for (const f of check.warnings) {
      issues.push({severity: 'warning', path: `monitors[${index}].code`, message: f.message, code: f.code, file: f.file, line: f.line})
    }
    const state = ctx.code.get(m.name) ?? {}
    if (check.prepared) state.prepared = check.prepared
    if (pin) state.runtimeId = pin
    ctx.code.set(m.name, state)
    if (runtime?.status === 'deprecated' || runtime?.eolAt) {
      issues.push({
        severity: 'warning',
        path: `monitors[${index}].config.runtimeId`,
        message: `Runtime ${runtime.id} is ${runtime.status ?? 'deprecated'}${runtime.eolAt ? `; end of life ${runtime.eolAt}` : ''}`,
        code: 'RUNTIME_EOL',
      })
    }
  }
  return {issues, checks}
}

const IGNORED_PLAYWRIGHT_KEYS: Array<[RegExp, string]> = [
  [/\bprojects\s*:/, 'projects'],
  [/\bwebServer\s*:/, 'webServer'],
  [/\bbaseURL\s*:/, 'use.baseURL (comes from the environment)'],
  [/\breporter\s*:/, 'reporter'],
]

/** Keys of `playwright.config.*` that the runtime ignores (D-12). */
export function ignoredPlaywrightKeys(dir: string): Issue[] {
  for (const name of ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs']) {
    const p = join(dir, name)
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf8')
    return IGNORED_PLAYWRIGHT_KEYS.filter(([re]) => re.test(text)).map(([, key]) => ({
      severity: 'warning' as const,
      path: name,
      message: `${name}: "${key}" is ignored by the DevHelm runtime`,
      code: 'PLAYWRIGHT_KEY_IGNORED',
      file: name,
    }))
  }
  return []
}

/**
 * `file:line` when the finding has a line. Otherwise the file plus the
 * field path (`devhelm.yml: monitors[0].type`), so a schema error still
 * names the offending field.
 */
export function formatIssue(i: Issue): string {
  const where = i.file && i.line
    ? `${i.file}:${i.line}`
    : [i.file, i.path && i.path !== i.file ? i.path : ''].filter(Boolean).join(': ')
  const code = i.code && i.code !== 'CONFIG_INVALID' ? ` [${i.code}]` : ''
  return `${where ? `${where}: ` : ''}${i.message}${code}`
}
