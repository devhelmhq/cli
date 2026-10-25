import {describe, expect, test} from 'vitest'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {checkExample, checkSkills, extractExamples, loadCommands} from '../../scripts/check-skill-examples.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const index = loadCommands(join(ROOT, 'oclif.manifest.json'))
const check = (text: string) => checkExample(text, index)

describe('skill example checker', () => {
  test('finds invocations in fences only, including after pipes', () => {
    const md = 'devhelm audit\n```bash\nprintf %s "$V" | devhelm secrets values set K --env s --value-stdin\n```\n'
    const found = extractExamples(md)
    expect(found).toEqual([{line: 3, text: 'secrets values set K --env s --value-stdin'}])
  })

  test('refuses a topic used as a command and unknown flags', () => {
    expect(check('audit --since 1h')?.problem).toMatch(/unknown command "devhelm audit"/)
    expect(check('runs')?.problem).toMatch(/is a topic/)
    expect(check('incidents reopen <id>')?.problem).toMatch(/unknown command/)
    expect(check('secrets create --bogus=x KEY')?.problem).toMatch(/unknown flag --bogus/)
  })

  test('accepts real commands with args, allowNo flags and placeholders', () => {
    expect(check('audit events --since 24h')).toEqual({id: 'audit events'})
    expect(check('monitors revisions list "Checkout"')).toEqual({id: 'monitors revisions list'})
    expect(check('deploy --no-test')).toEqual({id: 'deploy'})
    expect(check('<resource> create')).toBeNull()
  })

  test('every fenced devhelm example in skills/ is a real command whose --help runs', () => {
    const {examples, problems} = checkSkills({exec: true})
    expect(examples).toBeGreaterThan(50)
    expect(problems).toEqual([])
  }, 300_000)
})
