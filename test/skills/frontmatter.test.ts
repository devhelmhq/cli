import {describe, expect, test} from 'vitest'
import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SKILLS_DIR = join(ROOT, 'skills')

const EXPECTED_SKILLS = [
  'devhelm-configure',
  'devhelm-investigate',
  'devhelm-communicate',
  'devhelm-manage',
]

/**
 * Parse the YAML frontmatter block from the head of a SKILL.md file.
 * We support only the single-line `key: value` form (which is all the
 * skills spec uses). A tiny purpose-built parser keeps this test
 * dependency-free.
 */
function parseFrontmatter(body: string): Record<string, string> | null {
  if (!body.startsWith('---\n')) return null
  const end = body.indexOf('\n---', 4)
  if (end === -1) return null
  const block = body.slice(4, end)
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = /^([a-z_][a-z0-9_-]*):\s*(.*)$/i.exec(line)
    if (!m) continue
    out[m[1]!] = m[2]!.trim()
  }
  return out
}

describe('skills/ frontmatter', () => {
  test('each expected skill directory exists', () => {
    for (const s of EXPECTED_SKILLS) {
      const p = join(SKILLS_DIR, s)
      expect(statSync(p).isDirectory(), `${s} dir must exist`).toBe(true)
    }
  })

  for (const skill of EXPECTED_SKILLS) {
    test(`${skill}/SKILL.md has valid frontmatter`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md')
      const body = readFileSync(path, 'utf8')
      const fm = parseFrontmatter(body)
      expect(fm, `${skill}/SKILL.md must start with --- frontmatter block`).not.toBeNull()
      expect(fm!.name, 'name is required').toBeDefined()
      expect(fm!.description, 'description is required').toBeDefined()

      // Anthropic convention: name = lowercase-hyphens, ≤64 chars.
      expect(fm!.name).toMatch(/^[a-z0-9-]+$/)
      expect(fm!.name!.length).toBeLessThanOrEqual(64)

      // Description: ≤1024 chars; must not be empty.
      expect(fm!.description!.length).toBeGreaterThan(0)
      expect(fm!.description!.length).toBeLessThanOrEqual(1024)

      // Name should match the directory name.
      expect(fm!.name).toBe(skill)
    })
  }
})

describe('skills/ body size budget', () => {
  for (const skill of EXPECTED_SKILLS) {
    test(`${skill}/SKILL.md is <=500 lines`, () => {
      const path = join(SKILLS_DIR, skill, 'SKILL.md')
      const lines = readFileSync(path, 'utf8').split('\n').length
      expect(lines, 'Anthropic soft-limit').toBeLessThanOrEqual(500)
    })
  }

  test('every reference is <=500 lines', () => {
    for (const skill of EXPECTED_SKILLS) {
      const refsDir = join(SKILLS_DIR, skill, 'references')
      for (const f of walkMd(refsDir)) {
        const lines = readFileSync(f, 'utf8').split('\n').length
        expect(lines, f).toBeLessThanOrEqual(500)
      }
    }
  })
})

function walkMd(dir: string): string[] {
  const out: string[] = []
  try {
    for (const e of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, e.name)
      if (e.isDirectory()) out.push(...walkMd(full))
      else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
    }
  } catch {
    /* ignore non-existent dirs */
  }
  return out
}
