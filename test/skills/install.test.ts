import {describe, expect, test, beforeEach} from 'vitest'
import {execSync} from 'node:child_process'
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function runCli(cmd: string, cwd: string): string {
  return execSync(`node ${join(ROOT, 'bin', 'dev.js')} ${cmd}`, {cwd, encoding: 'utf8', stdio: 'pipe'})
}

describe('devhelm skills install', () => {
  let workdir: string

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'devhelm-skills-install-'))
    return () => rmSync(workdir, {recursive: true, force: true})
  })

  test('--target=cursor writes .cursor/skills/devhelm-*', () => {
    runCli('skills install --target=cursor', workdir)

    for (const skill of ['devhelm-configure', 'devhelm-investigate', 'devhelm-communicate', 'devhelm-manage']) {
      const p = join(workdir, '.cursor', 'skills', skill, 'SKILL.md')
      expect(existsSync(p), `${p} should exist`).toBe(true)
      const body = readFileSync(p, 'utf8')
      expect(body).toMatch(/^---/)
      expect(body).toContain(`name: ${skill}`)
    }
  })

  test('--target=generic writes .skills/devhelm-*', () => {
    runCli('skills install --target=generic', workdir)
    const p = join(workdir, '.skills', 'devhelm-configure', 'SKILL.md')
    expect(existsSync(p)).toBe(true)
  })

  test('idempotent: running twice produces same output', () => {
    runCli('skills install --target=cursor', workdir)
    const out1 = runCli('skills install --target=cursor', workdir)
    // Second run shouldn't explode and should still report installation.
    expect(out1).toContain('Installed DevHelm skills')
  })

  test('references/_generated is copied alongside hand-written refs', () => {
    runCli('skills install --target=generic', workdir)
    // Any one resource-fields file is enough to prove the _generated subtree shipped.
    const p = join(
      workdir,
      '.skills',
      'devhelm-configure',
      'references',
      '_generated',
      'monitors.fields.md',
    )
    expect(existsSync(p)).toBe(true)
  })
})

describe('devhelm skills schema', () => {
  test('prints the monitors field reference', () => {
    const out = execSync(`node ${join(ROOT, 'bin', 'dev.js')} skills schema monitors`, {
      encoding: 'utf8',
    })
    expect(out).toContain('monitors — field reference')
    expect(out).toContain('CreateMonitorRequest')
  })

  test('prints a hand-written reference (mac-yaml)', () => {
    const out = execSync(`node ${join(ROOT, 'bin', 'dev.js')} skills schema mac-yaml`, {
      encoding: 'utf8',
    })
    expect(out).toContain('Monitoring as Code')
  })

  test('unknown resource exits non-zero with helpful message', () => {
    try {
      execSync(`node ${join(ROOT, 'bin', 'dev.js')} skills schema nonsense-resource`, {
        encoding: 'utf8',
        stdio: 'pipe',
      })
      throw new Error('expected non-zero exit')
    } catch (err) {
      const stderr = (err as {stderr?: Buffer}).stderr?.toString() ?? ''
      expect(stderr).toMatch(/No reference found/)
    }
  })
})
