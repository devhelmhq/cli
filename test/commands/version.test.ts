import {expect, test} from 'vitest'
import {execSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'))

test('devhelm version prints version string', () => {
  const output = execSync('node bin/dev.js version', {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf8',
  }).trim()

  expect(output).toContain(`devhelm/${pkg.version}`)
  expect(output).toContain(process.platform)
  expect(output).toContain(`node-${process.version}`)
})

test('devhelm --help exits cleanly', () => {
  const output = execSync('node bin/dev.js --help', {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf8',
  }).trim()

  expect(output).toContain('devhelm')
})
