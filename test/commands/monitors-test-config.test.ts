import {expect, test, describe, beforeEach, afterEach} from 'vitest'
import {execSync} from 'node:child_process'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')

function run(argv: string): string {
  try {
    return execSync(`node bin/dev.js ${argv}`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    const e = err as {stdout?: string; stderr?: string; status?: number}
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

describe('monitors test --config', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'devhelm-monitors-test-'))
  })

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true})
  })

  function write(name: string, contents: string): string {
    const p = join(dir, name)
    writeFileSync(p, contents, 'utf8')
    return p
  }

  test('--help advertises both the id arg and the --config flag', () => {
    const out = run('monitors test --help')
    expect(out).toContain('[ID]')
    expect(out).toContain('--config=<value>')
    expect(out).toMatch(/--config[\s\S]*CreateMonitorRequest/)
  })

  test('errors when neither id nor --config is given', () => {
    const out = run('monitors test --api-token devhelm-dev-token --api-url http://127.0.0.1:9999')
    expect(out).toContain('Pass a monitor id to run a live test, or --config <file>')
  })

  test('errors when both id and --config are given', () => {
    const cfg = write(
      'm.yml',
      'name: x\ntype: HTTP\nmanagedBy: CLI\nconfig:\n  url: https://example.com\n  method: GET\n',
    )
    const out = run(
      `monitors test 11111111-1111-1111-1111-111111111111 --config ${cfg} --api-token devhelm-dev-token --api-url http://127.0.0.1:9999`,
    )
    expect(out).toContain('Pass either a monitor id')
  })

  test('reports a clear validation error for a malformed config', () => {
    const cfg = write('bad.yml', 'name: bad\ntype: HTTP\nconfig:\n  url: not-a-url\n')
    const out = run(
      `monitors test --config ${cfg} --api-token devhelm-dev-token --api-url http://127.0.0.1:9999`,
    )
    expect(out).toContain('failed CreateMonitorRequest validation')
    expect(out).toContain('managedBy')
  })

  test('errors when the config file does not exist', () => {
    const out = run(
      `monitors test --config ${join(dir, 'missing.yml')} --api-token devhelm-dev-token --api-url http://127.0.0.1:9999`,
    )
    expect(out).toContain('Config file not found')
  })

  test('accepts a JSON config and prints the validation success line', () => {
    const cfg = write(
      'm.json',
      JSON.stringify({
        name: 'json-monitor',
        type: 'HTTP',
        managedBy: 'CLI',
        config: {url: 'https://example.com', method: 'GET'},
      }),
    )
    const out = run(
      `monitors test --config ${cfg} --api-token devhelm-dev-token --api-url http://127.0.0.1:9999`,
    )
    // Validation line should print before the (expected) network failure
    // when the harness can't reach the dummy --api-url.
    expect(out).toContain('is valid against CreateMonitorRequest')
  })
})
