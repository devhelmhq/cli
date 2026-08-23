import {expect, test, describe} from 'vitest'
import {execSync} from 'node:child_process'
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
    const e = err as {stdout?: string; stderr?: string}
    return `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
}

describe('status-pages maintenance topic', () => {
  test('parent --help lists the maintenance topic', () => {
    const out = run('status-pages --help')
    expect(out).toContain('status-pages maintenance')
  })

  test('topic --help lists every subcommand', () => {
    const out = run('status-pages maintenance --help')
    for (const cmd of [
      'create',
      'list',
      'get',
      'update',
      'delete',
      'publish',
      'dismiss',
      'post-update',
    ]) {
      expect(out).toContain(`status-pages maintenance ${cmd}`)
    }
  })

  test('create --help requires title, impact, body, and scheduled-for', () => {
    const out = run('status-pages maintenance create --help')
    expect(out).toContain('--title=<value>')
    expect(out).toContain('--impact')
    expect(out).toContain('--body=<value>')
    expect(out).toContain('--scheduled-for=<value>')
  })
})

describe('status-pages incidents create --scheduled', () => {
  test('errors and points at maintenance create', () => {
    const out = run(
      'status-pages incidents create 00000000-0000-0000-0000-000000000001 --title t --impact MINOR --body b --scheduled --api-token x --api-url http://127.0.0.1:9',
    )
    expect(out).toContain('`--scheduled` is no longer valid on incident create')
    expect(out).toContain('status-pages maintenance create')
  })

  test('create --help does not advertise --scheduled', () => {
    const out = run('status-pages incidents create --help')
    expect(out).not.toContain('--scheduled')
  })
})
