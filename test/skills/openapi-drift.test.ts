import {expect, test} from 'vitest'
import {execSync} from 'node:child_process'
import {readFileSync, readdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Regenerates the _generated/*.fields.md files and asserts they match the
 * currently-committed copies byte-for-byte.
 *
 * If this fails, run `node scripts/generate-skill-references.mjs` and
 * commit the diff. The test keeps the skills in lock-step with the
 * OpenAPI spec in this repo — whenever `docs/openapi/monitoring-api.json`
 * changes (via spec-propagate from mono), the drift check fires.
 */
test('generated skill references are in sync with OpenAPI spec', () => {
  const before = snapshotGenerated()

  // Regenerate.
  execSync('node scripts/generate-skill-references.mjs', {cwd: ROOT, stdio: 'pipe'})

  const after = snapshotGenerated()

  const diffs: string[] = []
  for (const [path, content] of Object.entries(after)) {
    if (before[path] !== content) diffs.push(path)
  }
  for (const path of Object.keys(before)) {
    if (!(path in after)) diffs.push(`${path} (removed)`)
  }

  expect(
    diffs,
    `Generated skill references are stale. Run:\n    node scripts/generate-skill-references.mjs\n  and commit the diff.\nFiles out of sync:\n  ${diffs.join('\n  ')}`,
  ).toEqual([])
})

function snapshotGenerated(): Record<string, string> {
  const out: Record<string, string> = {}
  const skillsDir = join(ROOT, 'skills')
  for (const skill of readdirSync(skillsDir)) {
    if (!skill.startsWith('devhelm-')) continue
    const gen = join(skillsDir, skill, 'references', '_generated')
    let entries: string[]
    try {
      entries = readdirSync(gen)
    } catch {
      continue
    }
    for (const f of entries) {
      const rel = join(skill, 'references', '_generated', f)
      out[rel] = readFileSync(join(gen, f), 'utf8')
    }
  }
  return out
}
