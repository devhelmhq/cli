#!/usr/bin/env node
/**
 * Publish this CLI's skills into a devhelmhq/skill checkout (doc 42 §11),
 * so `npx skills add devhelmhq/skill` installs the same files as
 * `devhelm skills install`.
 *
 * Usage:  node scripts/sync-skill-repo.mjs <path-to-devhelmhq/skill>
 *
 * Replaces `<repo>/skills/` with this repo's `skills/` (byte-for-byte) and
 * writes `<repo>/VERSION` with the CLI version the skills were stamped
 * with. Run `npm run skillgen` first so the stamps and generated
 * references are current. Commit the result in the skill repo.
 */

import {cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/sync-skill-repo.mjs <path-to-devhelmhq/skill>')
  process.exit(2)
}
const repo = resolve(target)
if (!existsSync(join(repo, '.git'))) {
  console.error(`${repo} is not a git checkout of devhelmhq/skill`)
  process.exit(2)
}

const {version} = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const src = join(ROOT, 'skills')
// Refuse to publish skills whose stamps or generated references are stale.
for (const skill of readdirSync(src)) {
  const md = join(src, skill, 'SKILL.md')
  if (!existsSync(md)) continue
  if (!readFileSync(md, 'utf8').includes(`\n  version: "${version}"\n`)) {
    console.error(`${md} is not stamped with ${version}: run \`npm run skillgen\` first`)
    process.exit(2)
  }
  if (!existsSync(join(src, skill, 'references', '_generated'))) {
    console.error(`${skill} has no references/_generated: run \`npm run skillgen\` first`)
    process.exit(2)
  }
}
const dst = join(repo, 'skills')
rmSync(dst, {recursive: true, force: true})
cpSync(src, dst, {recursive: true})
writeFileSync(join(repo, 'VERSION'), `${version}\n`)
console.log(`Synced skills ${version} → ${dst}`)
