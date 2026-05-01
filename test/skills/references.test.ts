import {describe, expect, test} from 'vitest'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SKILLS_DIR = join(ROOT, 'skills')

const SKILLS = ['devhelm-configure', 'devhelm-investigate', 'devhelm-communicate', 'devhelm-manage']

/**
 * Extract `@references/<path>` citations from a SKILL.md body.
 * Anthropic's skill loader resolves them relative to the skill's own dir.
 */
function extractReferences(body: string): string[] {
  const re = /@references\/([A-Za-z0-9_\-./]+)/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) seen.add(m[1]!)
  return [...seen]
}

describe('SKILL.md → references/ integrity', () => {
  for (const skill of SKILLS) {
    test(`${skill}: every @references cite resolves`, () => {
      const skillDir = join(SKILLS_DIR, skill)
      const body = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
      const refs = extractReferences(body)

      expect(refs.length, `${skill} should cite at least one reference`).toBeGreaterThan(0)

      for (const r of refs) {
        // `@references/foo.md` ⇒ `references/foo.md` relative to skill dir.
        // `@_generated/...` is legal but citing only the leaf (without
        // `references/` prefix) means the loader infers `references/` — we
        // check both to be robust.
        const primary = join(skillDir, 'references', r)
        const fallback = join(skillDir, r)
        expect(existsSync(primary) || existsSync(fallback), `Unresolved ref: @references/${r} in ${skill}`).toBe(true)
      }
    })
  }

  test('no orphan reference files (in references/ but not cited by SKILL.md)', () => {
    const warnings: string[] = []
    for (const skill of SKILLS) {
      const refsDir = join(SKILLS_DIR, skill, 'references')
      if (!existsSync(refsDir)) continue

      const body = readFileSync(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8')
      const cited = new Set(extractReferences(body).map((r) => r.split('/').pop()))

      for (const f of readdirSync(refsDir)) {
        // Skip the generated subdir — referenced via its parent handwritten doc.
        if (f === '_generated') continue
        if (!f.endsWith('.md')) continue
        if (!cited.has(f)) warnings.push(`${skill}/${f} is not cited by SKILL.md`)
      }
    }

    // Orphans are a soft signal — fail only when the list is non-empty, so the
    // author sees it immediately rather than discovering at reference time.
    expect(warnings, warnings.join('; ')).toEqual([])
  })
})
