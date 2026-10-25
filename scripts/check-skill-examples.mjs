#!/usr/bin/env node
/**
 * Check every `devhelm …` example in a fenced code block of skills/**\/*.md
 * against the built CLI (doc 42 §11).
 *
 * For each example it finds the longest command id in oclif.manifest.json,
 * refuses unknown commands and unknown long flags, then runs
 * `devhelm <command> --help` once per distinct command through bin/run.js
 * so a command that is in the manifest but fails to load is caught too.
 *
 * Usage:  npm run build && node scripts/check-skill-examples.mjs [--no-exec]
 * Exit 1 lists every problem as `file:line · example · problem`.
 */

import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'oclif.manifest.json')
const SKILLS_DIR = join(ROOT, 'skills')

/** Flags every command accepts through oclif itself. */
const BUILTIN_FLAGS = new Set(['help'])

export function loadCommands(manifestPath = MANIFEST) {
  if (!existsSync(manifestPath)) throw new Error(`${manifestPath} is missing: run \`npm run build\` first`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const commands = new Map()
  const topics = new Set()
  for (const [id, cmd] of Object.entries(manifest.commands)) {
    const words = id.split(':')
    const flags = new Set(BUILTIN_FLAGS)
    for (const [name, flag] of Object.entries(cmd.flags ?? {})) {
      flags.add(name)
      if (flag.allowNo) flags.add(`no-${name}`)
      for (const alias of flag.aliases ?? []) flags.add(alias)
    }
    commands.set(words.join(' '), flags)
    for (let i = 1; i < words.length; i++) topics.add(words.slice(0, i).join(' '))
  }
  return {commands, topics}
}

function walkMd(dir) {
  const out = []
  for (const e of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...walkMd(full))
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full)
  }
  return out
}

/** `devhelm` invocations inside fenced blocks: {line, text} where text starts after `devhelm `. */
export function extractExamples(markdown) {
  const out = []
  let fenced = false
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced
      continue
    }
    if (!fenced) continue
    // Strip trailing comments, then find each invocation (start of line, after a pipe/&&/;, `$ `, `npx `).
    const code = line.replace(/\s#\s.*$/, '')
    const re = /(?:^|[|;&(]\s*|\$\s+|npx\s+|`)devhelm\s+([^|;&`)]*)/g
    let m
    while ((m = re.exec(code)) !== null) out.push({line: i + 1, text: m[1].trim()})
  }
  return out
}

function tokenize(text) {
  return text.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
}

/** null when the example is fine, else the problem. */
export function checkExample(text, {commands, topics}) {
  const tokens = tokenize(text)
  if (tokens.length === 0) return null
  // Placeholders such as `devhelm <resource> create` document a pattern, not a command.
  if (tokens[0].startsWith('<')) return null
  const words = []
  for (const t of tokens) {
    if (t.startsWith('-') || t.startsWith('<') || t.startsWith('"') || t.startsWith("'") || !/^[a-z][a-z0-9-]*$/.test(t)) break
    words.push(t)
  }
  let id
  for (let n = words.length; n > 0; n--) {
    const candidate = words.slice(0, n).join(' ')
    if (commands.has(candidate)) {
      id = candidate
      break
    }
  }
  if (!id) {
    const topic = words.join(' ')
    if (topics.has(topic) && tokens.length === words.length) return null
    if (tokens[0] === '--version' || tokens[0] === '--help') return null
    return {problem: `unknown command "devhelm ${words.join(' ') || tokens[0]}"`}
  }
  const flags = commands.get(id)
  for (const t of tokens) {
    const m = /^--([a-z][a-z0-9-]*)/.exec(t)
    if (m && !flags.has(m[1])) return {id, problem: `unknown flag --${m[1]} on "devhelm ${id}"`}
  }
  return {id}
}

export function checkSkills({exec = true, skillsDir = SKILLS_DIR, manifestPath = MANIFEST} = {}) {
  const index = loadCommands(manifestPath)
  const problems = []
  const used = new Map()
  let examples = 0
  for (const file of walkMd(skillsDir)) {
    const rel = relative(ROOT, file)
    for (const ex of extractExamples(readFileSync(file, 'utf8'))) {
      examples++
      const result = checkExample(ex.text, index)
      if (!result) continue
      if (result.problem) problems.push(`${rel}:${ex.line} · devhelm ${ex.text} · ${result.problem}`)
      else if (!used.has(result.id)) used.set(result.id, `${rel}:${ex.line}`)
    }
  }
  if (exec) {
    const bin = join(ROOT, 'bin', 'run.js')
    for (const [id, where] of used) {
      try {
        execFileSync(process.execPath, [bin, ...id.split(' '), '--help'], {stdio: 'pipe', env: {...process.env, NO_COLOR: '1'}})
      } catch (err) {
        problems.push(`${where} · devhelm ${id} --help · exited ${err.status}: ${String(err.stderr ?? '').trim().split('\n')[0]}`)
      }
    }
  }
  return {examples, commands: used.size, problems}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {examples, commands, problems} = checkSkills({exec: !process.argv.includes('--no-exec')})
  if (problems.length > 0) {
    console.error(`Skill examples reference commands or flags this CLI does not have:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`Checked ${examples} skill examples across ${commands} commands.`)
}
