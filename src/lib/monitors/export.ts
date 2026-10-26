/**
 * `monitors export`: the live revision's files, a devhelm.yml entry using
 * the doc 42 §6.2 keys, and a fidelity report of what YAML can't express.
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {join, relative, sep} from 'node:path'
import {parse as parseYaml, stringify as yamlStringify} from 'yaml'
import type {MonitorDto} from './resolve.js'
import {isCodeType} from './resolve.js'

export type YamlEntry = Record<string, unknown>

function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) if (val !== null && val !== undefined) out[k] = stripNulls(val)
    return out
  }
  return v
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'monitor'
}

/** One devhelm.yml monitor entry. `codePath` is relative to the written devhelm.yml. */
export function yamlEntryFor(m: MonitorDto, opts: {codePath?: string | {entrypoint: string; include: string[]}; channelNames: Map<string, string>}): YamlEntry {
  const e: YamlEntry = {name: m.name, type: m.type}
  if (m.environment?.slug) e.environment = m.environment.slug
  if (isCodeType(m.type)) {
    if (opts.codePath) e.code = opts.codePath
  } else {
    e.config = stripNulls(m.config)
  }
  e.frequencySeconds = m.frequencySeconds
  if (m.regions.length > 0) e.regions = [...m.regions]
  if (m.runParallel !== null && m.runParallel !== undefined && isCodeType(m.type)) e.runParallel = m.runParallel
  if (m.fastRetryMaxAttempts) e.fastRetryMaxAttempts = m.fastRetryMaxAttempts
  const capture = stripNulls(m.capturePolicy ?? {}) as Record<string, unknown>
  if (Object.keys(capture).length > 0) e.capturePolicy = capture
  const channels = (m.alertChannelIds ?? []).map((id) => opts.channelNames.get(id) ?? id)
  if (channels.length > 0) e.alertChannels = channels
  if (m.secretKeys && m.secretKeys.length > 0) e.secretKeys = [...m.secretKeys]
  if (isCodeType(m.type)) {
    const cfg = stripNulls(m.config) as Record<string, unknown>
    if (Object.keys(cfg).length > 0) e.config = cfg
  }
  const tags = (m.tags ?? []).map((t) => t.name)
  if (tags.length > 0) e.tags = tags
  return e
}

/** Fields set on the monitor that the YAML entry does not carry. */
export function fidelityReport(m: MonitorDto): string[] {
  const out: string[] = []
  if (m.pausedAt || m.enabled === false) out.push('paused: an overlay, set with `devhelm monitors pause|resume`')
  if (m.muted) out.push('muted: an overlay, set with `devhelm monitors mute|unmute`')
  if (m.quarantineUntil) out.push('quarantined: an overlay, set with `devhelm monitors quarantine|release-quarantine`')
  if (m.auth) out.push('auth: secret-backed auth is not exported; re-declare it with a secret reference')
  if (m.incidentPolicy) out.push('incidentPolicy: not exported; it keeps its current value')
  if ((m.assertions ?? []).length > 0) out.push(`assertions: ${(m.assertions ?? []).length} not exported`)
  if (m.owner?.project || m.managedBy) out.push(`owner: ${m.owner?.type ?? m.managedBy}${m.owner?.project ? ` · ${m.owner.project}` : ''} (ownership moves with \`devhelm import monitor\` or \`monitors transfer\`)`)
  if (isCodeType(m.type)) {
    out.push('secret values: never exported; set them with `devhelm secrets values set <KEY> --env <slug> --value-stdin`')
    out.push('revision history: stays on the server (`devhelm monitors revisions list`)')
  }
  return out
}

/** Merge entries into `<dir>/devhelm.yml`, replacing entries with the same name + environment. */
export function writeYamlEntries(dir: string, entries: YamlEntry[]): string {
  const file = join(dir, 'devhelm.yml')
  let doc: Record<string, unknown> = {}
  if (existsSync(file)) {
    const parsed = parseYaml(readFileSync(file, 'utf8')) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>
  }
  const existing = Array.isArray(doc.monitors) ? (doc.monitors as YamlEntry[]) : []
  const key = (e: YamlEntry) => `${String(e.name)}@${String(e.environment ?? '')}`
  const incoming = new Set(entries.map(key))
  doc.monitors = [...existing.filter((e) => !incoming.has(key(e))), ...entries]
  writeFileSync(file, yamlStringify(doc))
  return file
}

/**
 * Where a revision's files go so the local closure digest equals the live
 * one: revision paths are relative to the bundle root, which is the git
 * root (or the devhelm.yml directory). Returns the `code:` value for the
 * devhelm.yml in `yamlDir`: the entrypoint, plus `include` for every other
 * revision file so files nothing imports (fixtures) still ship.
 */
export function codeEntryFor(yamlDir: string, root: string, files: {entrypoint: string; files: Record<string, string>}): string | {entrypoint: string; include: string[]} {
  const rel = (p: string) => relative(yamlDir, join(root, p)).split(sep).join('/')
  const others = Object.keys(files.files).filter((p) => p !== files.entrypoint).sort()
  return others.length === 0 ? rel(files.entrypoint) : {entrypoint: rel(files.entrypoint), include: others.map(rel)}
}
