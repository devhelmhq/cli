/**
 * After a rollback: warn when the local devhelm.yml still declares other
 * code than the new live revision, since the next deploy would re-apply
 * it (and is refused until acknowledged).
 */
import {existsSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {parse as parseYaml} from 'yaml'
import {prepareCode, type CodeInput} from '../code/bundle.js'
import {DevhelmError} from '../errors.js'

interface DeclaredMonitor {
  name?: unknown
  environment?: unknown
  code?: unknown
}

function declaredCode(file: string, name: string, envSlug: string | undefined): {code: CodeInput; baseDir: string} | undefined {
  if (!existsSync(file)) return undefined
  let doc: unknown
  try {
    doc = parseYaml(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
  const monitors = (doc as {monitors?: unknown})?.monitors
  if (!Array.isArray(monitors)) return undefined
  for (const m of monitors as DeclaredMonitor[]) {
    if (m?.name !== name) continue
    if (envSlug && typeof m.environment === 'string' && m.environment !== envSlug) continue
    if (typeof m.code === 'string') return {code: m.code, baseDir: dirname(file)}
    const c = m.code as {entrypoint?: unknown; include?: unknown} | undefined
    if (c && typeof c.entrypoint === 'string') {
      const include = Array.isArray(c.include) ? c.include.filter((x): x is string => typeof x === 'string') : undefined
      return {code: {entrypoint: c.entrypoint, include}, baseDir: dirname(file)}
    }
  }
  return undefined
}

/** The warning lines, or [] when the file matches, is absent, or can't be bundled here. */
export async function repoWarning(opts: {cwd: string; name: string; envSlug?: string; liveDigest: string; previousRevisionId?: string}): Promise<string[]> {
  const declared = declaredCode(join(opts.cwd, 'devhelm.yml'), opts.name, opts.envSlug)
  if (!declared) return []
  try {
    const prepared = await prepareCode(declared.code, {baseDir: declared.baseDir})
    if (prepared.digest === opts.liveDigest) return []
  } catch (err) {
    if (err instanceof DevhelmError) return []
    throw err
  }
  const from = opts.previousRevisionId ? `${opts.previousRevisionId}'s code` : 'other code'
  return [
    `devhelm.yml still points at ${from}. The next deploy will refuse until you revert the file`,
    `  or run: devhelm deploy --acknowledge-rollback ${opts.name}`,
  ]
}
