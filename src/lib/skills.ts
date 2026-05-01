/**
 * Shared helpers for the `devhelm skills *` subcommands.
 *
 * Primary responsibilities:
 *   - Locate the `skills/` directory relative to the installed CLI.
 *   - Enumerate skill names + their file trees.
 *   - Resolve per-host install locations (Cursor, Claude Code, …).
 *   - Idempotent file copying.
 */

import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export const SKILL_NAMES = [
  'devhelm-configure',
  'devhelm-investigate',
  'devhelm-communicate',
  'devhelm-manage',
] as const
export type SkillName = (typeof SKILL_NAMES)[number]

export const HOSTS = {
  cursor: {project: '.cursor/skills', global: '.cursor/skills'},
  'claude-code': {project: '.claude/skills', global: '.claude/skills'},
  codex: {project: '.codex/skills', global: '.codex/skills'},
  windsurf: {project: '.windsurf/skills', global: '.windsurf/skills'},
  gemini: {project: '.gemini/skills', global: '.gemini/skills'},
  generic: {project: '.skills', global: '.skills'},
} as const
export type Host = keyof typeof HOSTS

// Claude Desktop takes a zip via its Settings → Skills UI; not installable
// directly via a filesystem copy. Bundle command handles this separately.
export const CLAUDE_DESKTOP = 'claude-desktop'

/**
 * Resolve the directory containing the bundled skills.
 *
 * In production installs, this is `node_modules/devhelm/skills/`; the files
 * live alongside the compiled `dist/` because they are declared in the
 * `files` field of package.json. In local dev (e.g. `npm link`), the CLI
 * still resolves to the same repo-relative layout.
 */
export function resolveSkillsDir(): string {
  // __dirname at runtime is `<pkg>/dist/lib` (after tsc build) or
  // `<pkg>/src/lib` (ts-node dev run); either way, walking up twice lands
  // us at the package root, which is where `skills/` lives.
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(here, '..', '..', 'skills'), // production: dist/lib → <pkg>/skills
    resolve(here, '..', '..', '..', 'skills'), // ts-node: src/lib → <pkg>/skills
  ]
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isDirectory()) return c
  }
  throw new Error(
    `Could not locate bundled skills/ directory. Tried:\n  ${candidates.join(
      '\n  ',
    )}\nThis is a packaging bug; please file an issue.`,
  )
}

/**
 * List installed agent hosts on this machine (best-effort detection).
 *
 * Returns the set of hosts whose config directory exists in $HOME, which
 * is a reasonable proxy for "user has this agent installed". Generic is
 * always considered available as a fallback.
 */
export function detectHosts(): Host[] {
  const home = homedir()
  const probes: Array<{host: Host; paths: string[]}> = [
    {host: 'cursor', paths: ['.cursor', 'Library/Application Support/Cursor', 'AppData/Roaming/Cursor']},
    {host: 'claude-code', paths: ['.claude']},
    {host: 'codex', paths: ['.codex']},
    {host: 'windsurf', paths: ['.windsurf', 'Library/Application Support/Windsurf']},
    {host: 'gemini', paths: ['.gemini']},
  ]
  const found = new Set<Host>()
  for (const {host, paths} of probes) {
    for (const p of paths) {
      if (existsSync(join(home, p))) {
        found.add(host)
        break
      }
    }
  }
  return found.size === 0 ? ['generic'] : [...found]
}

/**
 * Where to install skills for a given host, per scope.
 */
export function installTarget(host: Host, scope: 'project' | 'global', cwd = process.cwd()): string {
  const entry = HOSTS[host]
  return scope === 'global' ? join(homedir(), entry.global) : join(cwd, entry.project)
}

/** Recursively copy src → dst, idempotent. Returns a count of files written. */
export function copyDir(src: string, dst: string): number {
  let count = 0
  const entries = readdirSync(src, {withFileTypes: true})
  mkdirSync(dst, {recursive: true})
  for (const e of entries) {
    const s = join(src, e.name)
    const d = join(dst, e.name)
    if (e.isDirectory()) {
      count += copyDir(s, d)
    } else if (e.isFile()) {
      const bytes = readFileSync(s)
      if (existsSync(d)) {
        const existing = readFileSync(d)
        if (bytes.equals(existing)) continue // true no-op, don't bump mtime
      }
      writeFileSync(d, bytes)
      count += 1
    }
  }
  return count
}

export function listSkills(root: string): SkillName[] {
  const names = readdirSync(root, {withFileTypes: true})
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n): n is SkillName => (SKILL_NAMES as readonly string[]).includes(n))
  return names
}
