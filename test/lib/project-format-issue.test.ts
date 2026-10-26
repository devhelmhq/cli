import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {formatIssue, loadProject} from '../../src/lib/project/project.js'

describe('formatIssue names the offending field', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) rmSync(dir, {recursive: true, force: true})
    dir = undefined
  })

  function messages(yaml: string): string[] {
    dir = mkdtempSync(join(tmpdir(), 'devhelm-issue-'))
    const file = join(dir, 'devhelm.yml')
    writeFileSync(file, yaml)
    return loadProject([file]).issues.filter((i) => i.severity === 'error').map(formatIssue)
  }

  it('schema error on a monitor type carries the field path next to the file', () => {
    const out = messages('monitors:\n  - name: bad-type\n    type: FTP\n    config:\n      url: https://example.com\n')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/devhelm\.yml: monitors\[0\]\.type: /)
  })

  it('schema error on empty escalation steps carries the field path', () => {
    const out = messages('notificationPolicies:\n  - name: critical\n    escalation:\n      steps: []\n')
    expect(out[0]).toContain('notificationPolicies[0].escalation.steps: ')
  })

  it('file:line wins when the finding has a line', () => {
    expect(formatIssue({severity: 'error', path: 'monitors[0].code', message: 'boom', file: 'a.spec.ts', line: 3, code: 'IMPORT_NOT_IN_BUNDLE'}))
      .toBe('a.spec.ts:3: boom [IMPORT_NOT_IN_BUNDLE]')
  })

  it('does not repeat the path when it is the file', () => {
    expect(formatIssue({severity: 'warning', path: 'playwright.config.ts', message: 'ignored', file: 'playwright.config.ts'}))
      .toBe('playwright.config.ts: ignored')
  })

  it('path alone when there is no file', () => {
    expect(formatIssue({severity: 'error', path: 'monitors[1].name', message: 'duplicate'})).toBe('monitors[1].name: duplicate')
  })
})
