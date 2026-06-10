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

describe('services topic', () => {
  test('topic --help lists every subcommand', () => {
    const out = run('services --help')
    for (const cmd of [
      'list',
      'get',
      'status',
      'summary',
      'components',
      'categories',
      'uptime',
      'incidents',
      'maintenances',
    ]) {
      expect(out).toContain(`services ${cmd}`)
    }
    expect(out).toContain('Browse the status-data service catalog')
  })

  test('list --help advertises catalog filters and cursor pagination', () => {
    const out = run('services list --help')
    for (const flag of ['--category', '--search', '--status', '--limit', '--cursor']) {
      expect(out).toContain(flag)
    }
    expect(out).toContain('[default: 20]')
  })

  test('get --help requires a slug arg', () => {
    const out = run('services get --help')
    expect(out).toContain('SLUG')
    expect(out).toContain('Service slug or ID')
  })

  test('status --help describes the lightweight live snapshot', () => {
    const out = run('services status --help')
    expect(out).toContain('live status')
  })

  test('summary --help describes the global status rollup', () => {
    const out = run('services summary --help')
    expect(out).toContain('global status summary')
  })

  test('uptime --help exposes --period, --granularity, and component-level flags', () => {
    const out = run('services uptime --help')
    expect(out).toContain('--period')
    expect(out).toContain('[default: 30d]')
    expect(out).toContain('--granularity')
    expect(out).toContain('--component')
    expect(out).toContain('--from')
    expect(out).toContain('--to')
  })

  test('uptime rejects combining --granularity with --component', () => {
    const out = run(
      'services uptime aws-ec2 --component 11111111-1111-1111-1111-111111111111 --granularity daily',
    )
    expect(out).toContain('cannot also be provided when using --granularity')
  })

  test('uptime rejects --from without --component', () => {
    const out = run('services uptime aws-ec2 --from 2026-06-01T00:00:00Z')
    expect(out).toContain('All of the following must be provided when using --from: --component')
  })

  test('uptime rejects a malformed --component UUID locally', () => {
    const out = run('services uptime aws-ec2 --component not-a-uuid')
    expect(out).toContain('Invalid UUID format')
  })

  test('incidents --help takes optional slug and incidentId plus --status and --from', () => {
    const out = run('services incidents --help')
    expect(out).toContain('[SLUG]')
    expect(out).toContain('[INCIDENTID]')
    expect(out).toContain('full detail')
    expect(out).toContain('--status')
    expect(out).toContain('active|resolved')
    expect(out).toContain('--from')
  })

  test('incidents rejects an unknown --status value locally', () => {
    const out = run('services incidents stripe --status nonsense')
    expect(out).toContain('Expected --status=nonsense to be one of: active, resolved')
  })
})

describe('data services back-compat shims', () => {
  test('data services status still resolves', () => {
    const out = run('data services status --help')
    expect(out).toContain('live status')
  })

  test('data services uptime still resolves with the same flags', () => {
    const out = run('data services uptime --help')
    expect(out).toContain('--period')
    expect(out).toContain('--granularity')
  })
})
