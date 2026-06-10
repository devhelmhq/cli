import {expect, test, describe} from 'vitest'
import {execSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')

function run(argv: string): string {
  // Some help / --help invocations exit 0; flag-validation errors exit
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

describe('dependencies topic', () => {
  test('topic --help lists every subcommand including update', () => {
    const out = run('dependencies --help')
    for (const cmd of ['list', 'get', 'track', 'delete', 'update']) {
      expect(out).toContain(`dependencies ${cmd}`)
    }
  })

  test('track --help exposes --component and --alert-sensitivity with spec values', () => {
    const out = run('dependencies track --help')
    expect(out).toContain('--component')
    expect(out).toContain('--alert-sensitivity')
    expect(out).toContain('ALL|AWARENESS|INCIDENTS_ONLY|MAJOR_ONLY')
  })

  test('track rejects an invalid --alert-sensitivity value locally', () => {
    const out = run('dependencies track stripe --alert-sensitivity LOUD')
    expect(out).toContain(
      'Expected --alert-sensitivity=LOUD to be one of: ALL, AWARENESS, INCIDENTS_ONLY, MAJOR_ONLY',
    )
  })

  test('track rejects a malformed --component UUID locally', () => {
    const out = run('dependencies track stripe --component not-a-uuid')
    expect(out).toContain('Invalid UUID format')
  })

  test('update --help requires --alert-sensitivity', () => {
    const out = run('dependencies update --help')
    expect(out).toContain('SUBSCRIPTIONID')
    expect(out).toContain('(required)')
    expect(out).toContain('ALL|AWARENESS|INCIDENTS_ONLY|MAJOR_ONLY')
  })

  test('update errors without --alert-sensitivity', () => {
    const out = run('dependencies update 11111111-1111-1111-1111-111111111111')
    expect(out).toContain('Missing required flag alert-sensitivity')
  })

  test('update rejects a malformed subscriptionId locally', () => {
    const out = run('dependencies update not-a-uuid --alert-sensitivity ALL')
    expect(out).toContain('Invalid UUID format')
  })
})
