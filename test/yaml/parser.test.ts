import {describe, it, expect, afterEach} from 'vitest'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {parseConfigFile, loadConfig, ParseError} from '../../src/lib/yaml/parser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtures = join(__dirname, '..', 'fixtures', 'yaml')

const tmpDirs: string[] = []
function makeTmpDir(): string {
  const dir = join(tmpdir(), `devhelm-parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, {recursive: true})
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const d of tmpDirs) rmSync(d, {recursive: true, force: true})
  tmpDirs.length = 0
})

describe('parser', () => {
  describe('parseConfigFile', () => {
    it('parses minimal valid config', () => {
      const config = parseConfigFile(join(fixtures, 'valid', 'minimal.yml'))
      expect(config.monitors).toHaveLength(1)
      expect(config.monitors![0].name).toBe('Simple Health Check')
      expect(config.monitors![0].type).toBe('HTTP')
    })

    it('parses full-stack config with all sections', () => {
      const config = parseConfigFile(join(fixtures, 'valid', 'full-stack.yml'))
      expect(config.tags).toHaveLength(2)
      expect(config.environments).toHaveLength(2)
      expect(config.secrets).toHaveLength(1)
      expect(config.alertChannels).toHaveLength(3)
      expect(config.notificationPolicies).toHaveLength(1)
      expect(config.webhooks).toHaveLength(1)
      expect(config.resourceGroups).toHaveLength(1)
      expect(config.monitors).toHaveLength(7)
      expect(config.dependencies).toHaveLength(2)
    })

    it('resolves env vars with fallbacks', () => {
      const config = parseConfigFile(join(fixtures, 'valid', 'env-vars.yml'))
      expect(config.monitors![0].config).toHaveProperty('url', 'https://default.example.com')
    })

    it('resolves env vars from environment', () => {
      process.env.APP_URL = 'https://custom.example.com'
      try {
        const config = parseConfigFile(join(fixtures, 'valid', 'env-vars.yml'))
        expect(config.monitors![0].config).toHaveProperty('url', 'https://custom.example.com')
      } finally {
        delete process.env.APP_URL
      }
    })

    it('throws on missing file', () => {
      expect(() => parseConfigFile('nonexistent.yml')).toThrow(ParseError)
    })

    it('throws on missing required env var', () => {
      delete process.env.MISSING_SECRET_VALUE
      expect(() => parseConfigFile(join(fixtures, 'invalid', 'missing-env-var.yml'))).toThrow(ParseError)
    })

    it('skips env var resolution when resolveEnv is false', () => {
      const config = parseConfigFile(join(fixtures, 'invalid', 'missing-env-var.yml'), false)
      expect(config.secrets![0].value).toContain('${MISSING_SECRET_VALUE}')
    })

    it('throws on invalid YAML syntax', () => {
      const dir = makeTmpDir()
      writeFileSync(join(dir, 'bad.yml'), ':\n  foo: [unclosed')
      expect(() => parseConfigFile(join(dir, 'bad.yml'))).toThrow(ParseError)
    })

    it('throws on empty file (null parsed)', () => {
      const dir = makeTmpDir()
      writeFileSync(join(dir, 'empty.yml'), '')
      expect(() => parseConfigFile(join(dir, 'empty.yml'))).toThrow(ParseError)
    })

    it('throws on scalar YAML (not an object)', () => {
      const dir = makeTmpDir()
      writeFileSync(join(dir, 'scalar.yml'), 'just a string')
      expect(() => parseConfigFile(join(dir, 'scalar.yml'))).toThrow(ParseError)
    })
  })

  describe('loadConfig', () => {
    it('loads single file', () => {
      const config = loadConfig([join(fixtures, 'valid', 'minimal.yml')])
      expect(config.monitors).toHaveLength(1)
    })

    it('merges multiple files', () => {
      const config = loadConfig([
        join(fixtures, 'valid', 'multi-a.yml'),
        join(fixtures, 'valid', 'multi-b.yml'),
      ])
      expect(config.tags).toHaveLength(2)
      expect(config.monitors).toHaveLength(2)
      expect(config.tags![0].name).toBe('backend')
      expect(config.tags![1].name).toBe('frontend')
    })

    it('applies defaults to monitors', () => {
      const config = loadConfig([join(fixtures, 'valid', 'defaults.yml')])
      expect(config.monitors![0].frequencySeconds).toBe(120)
      expect(config.monitors![0].regions).toEqual(['us-east', 'eu-west'])
      expect(config.monitors![1].frequencySeconds).toBe(30)
      expect(config.monitors![1].regions).toEqual(['us-west'])
    })

    it('throws on empty paths', () => {
      expect(() => loadConfig([])).toThrow()
    })

    it('loads directory of YAML files', () => {
      const dir = makeTmpDir()
      writeFileSync(join(dir, 'a.yml'), 'tags:\n  - name: from-a')
      writeFileSync(join(dir, 'b.yaml'), 'tags:\n  - name: from-b')
      writeFileSync(join(dir, 'ignored.txt'), 'not yaml')
      const config = loadConfig([dir])
      expect(config.tags).toHaveLength(2)
      expect(config.tags!.map((t) => t.name).sort()).toEqual(['from-a', 'from-b'])
    })

    it('loads directory files in sorted order', () => {
      const dir = makeTmpDir()
      writeFileSync(join(dir, 'z.yml'), 'tags:\n  - name: z')
      writeFileSync(join(dir, 'a.yml'), 'tags:\n  - name: a')
      const config = loadConfig([dir])
      expect(config.tags![0].name).toBe('a')
      expect(config.tags![1].name).toBe('z')
    })

    it('throws on empty directory', () => {
      const dir = makeTmpDir()
      expect(() => loadConfig([dir])).toThrow(ParseError)
    })

    it('ignores nested directories (non-recursive)', () => {
      const dir = makeTmpDir()
      writeFileSync(join(dir, 'root.yml'), 'tags:\n  - name: root')
      const nested = join(dir, 'nested')
      mkdirSync(nested)
      writeFileSync(join(nested, 'child.yml'), 'tags:\n  - name: child')
      const config = loadConfig([dir])
      expect(config.tags).toHaveLength(1)
      expect(config.tags![0].name).toBe('root')
    })

    it('throws on nonexistent path', () => {
      expect(() => loadConfig(['/nonexistent/path'])).toThrow(ParseError)
    })
  })
})
