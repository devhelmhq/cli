import {expect, test, describe} from 'vitest'
import {execSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')

function run(argv: string): string {
  // Some help / --help invocations exit 0; mutual-exclusion errors exit
  // non-zero. Capture stderr too so the assertions can match either.
  try {
    return execSync(`node bin/dev.js ${argv}`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    // execSync throws on non-zero exit; normalize to stdout+stderr.
    const e = err as {stdout?: string; stderr?: string; status?: number}
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

describe('maintenance-windows topic', () => {
  test('topic --help lists every subcommand', () => {
    const out = run('maintenance-windows --help')
    for (const cmd of ['list', 'get', 'create', 'update', 'cancel']) {
      expect(out).toContain(`maintenance-windows ${cmd}`)
    }
    expect(out).toContain('Schedule downtime windows')
  })

  test('list --help advertises the server-supported status filter', () => {
    const out = run('maintenance-windows list --help')
    expect(out).toContain('--status')
    // Past / cancelled are intentionally NOT listed — the API only filters
    // on active / upcoming and we shouldn't pretend otherwise.
    expect(out).toContain('active|upcoming')
  })

  test('create --help requires --start and --end', () => {
    const out = run('maintenance-windows create --help')
    expect(out).toContain('--start=<value>')
    expect(out).toContain('--end=<value>')
    expect(out).toMatch(/--monitor[^\n]*Monitor ID/)
    expect(out).toContain('--org-wide')
  })

  test('create errors when neither --monitor nor --org-wide is provided', () => {
    const out = run(
      'maintenance-windows create --start 2026-06-01T14:00:00Z --end 2026-06-01T14:30:00Z --reason Deploy --api-token devhelm-dev-token --api-url http://127.0.0.1:9999',
    )
    expect(out).toContain('Pass --monitor <uuid> or --org-wide')
  })

  test('create rejects passing both --monitor and --org-wide', () => {
    const out = run(
      'maintenance-windows create --start 2026-06-01T14:00:00Z --end 2026-06-01T14:30:00Z --reason Deploy --monitor 11111111-1111-1111-1111-111111111111 --org-wide --api-token devhelm-dev-token --api-url http://127.0.0.1:9999',
    )
    expect(out).toContain('cannot also be provided when using --org-wide')
  })

  test('cancel --help mentions --yes', () => {
    const out = run('maintenance-windows cancel --help')
    expect(out).toContain('--yes')
  })
})
