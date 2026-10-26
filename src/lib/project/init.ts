/**
 * `devhelm init --browser <name> | --api <name>` (doc 37, doc 42 §6.3).
 *
 * Writes a starter check (browser: a page journey; API: a request journey),
 * a plan-valid devhelm.yml entry (frequency at the plan floor from
 * /entitlements, an alertChannels placeholder, `project:` from the git
 * remote) and `.devhelm/` in .gitignore. Never launches an agent: it
 * installs skills when an agent is detected (or --agent / --skills) and
 * copies or prints the starter prompt. Login is skippable and files are
 * written even when it fails. Idempotent; never rewrites existing monitors.
 */
import {execFileSync, spawnSync} from 'node:child_process'
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {parseDocument} from 'yaml'
import {repoFromRemote} from '@devhelm/sdk/bundler'
import {ValidationError} from '../errors.js'
import {copyDir, detectHosts, installTarget, listSkills, resolveSkillsDir, HOSTS, type Host} from '../skills.js'
import {slugify} from '../monitors/export.js'

export type StarterKind = 'browser' | 'api'

export const DEFAULT_FREQUENCY = 3600

export function browserStarter(name: string): string {
  return `import {test, expect} from '@playwright/test'

// ${name}: a browser journey. BASE_URL comes from the environment's
// variables or secrets; never hard-code credentials (use secrets).
test('${name.replace(/'/g, "\\'")}', async ({page}) => {
  await page.goto(process.env.BASE_URL ?? 'https://example.com')
  await expect(page).toHaveTitle(/.+/)
})
`
}

export function apiStarter(name: string): string {
  return `import {test, expect} from '@playwright/test'

// ${name}: a request journey. API_URL comes from the environment's
// variables or secrets; put tokens in secrets, never in code.
test('${name.replace(/'/g, "\\'")}', async ({request}) => {
  const res = await request.get(\`\${process.env.API_URL ?? 'https://example.com'}/\`)
  expect(res.status()).toBeLessThan(400)
})
`
}

export function gitProject(cwd: string): string | undefined {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim()
    return url ? repoFromRemote(url) || undefined : undefined
  } catch {
    return undefined
  }
}

/** Agent detection (doc 37 C2): --agent / DEVHELM_AGENT, then agent env vars. */
export function detectAgent(explicit?: string, env: NodeJS.ProcessEnv = process.env): Host | undefined {
  if (explicit) {
    if (!(explicit in HOSTS)) throw new ValidationError(`Unknown --agent "${explicit}". One of: ${Object.keys(HOSTS).join(', ')}`, {code: 'FIELD_INVALID_FORMAT'})
    return explicit as Host
  }
  if (env.CLAUDECODE === '1') return 'claude-code'
  if (env.CURSOR_TRACE_ID || env.CURSOR_AGENT) return 'cursor'
  if (env.CODEX_SANDBOX || env.CODEX_CI) return 'codex'
  if (env.DEVHELM_AGENT === '1') return detectHosts()[0]
  return undefined
}

export interface WriteResult {
  wrote: string[]
  checkFile: string
  yamlFile: string
}

/** Write the starter check and the devhelm.yml entry. */
export function writeStarter(opts: {
  dir: string
  /** Absolute devhelm.yml path. */
  yamlFile: string
  kind: StarterKind
  name: string
  project?: string
  environment: string
  frequencySeconds: number
  force: boolean
}): WriteResult {
  const wrote: string[] = []
  const slug = slugify(opts.name)
  const yamlFile = opts.yamlFile
  const checkRel = `synthetics/${slug}.spec.ts`
  const checkFile = join(dirname(yamlFile), checkRel)

  const doc = existsSync(yamlFile) ? parseDocument(readFileSync(yamlFile, 'utf8')) : parseDocument('')
  const monitors = doc.get('monitors')
  const names = new Set<string>()
  if (monitors && typeof monitors === 'object' && 'items' in monitors) {
    for (const item of (monitors as {items: Array<{get?: (k: string) => unknown}>}).items) {
      const n = item.get?.('name')
      if (typeof n === 'string') names.add(n)
    }
  }
  const exists = names.has(opts.name)
  if (exists && !opts.force) {
    throw new ValidationError(`${relative(opts.dir, yamlFile)} already has a monitor named "${opts.name}". Pick another name, or --force to re-create only its starter file`, {code: 'DUPLICATE_MONITOR_NAME'})
  }

  if (!existsSync(checkFile) || opts.force) {
    mkdirSync(dirname(checkFile), {recursive: true})
    writeFileSync(checkFile, opts.kind === 'browser' ? browserStarter(opts.name) : apiStarter(opts.name))
    wrote.push(relative(opts.dir, checkFile))
  }

  if (!exists) {
    if (!doc.has('project') && opts.project) doc.set('project', opts.project)
    const entry = doc.createNode({
      name: opts.name,
      type: opts.kind === 'browser' ? 'BROWSER' : 'MULTI_STEP_API',
      environment: opts.environment,
      code: checkRel,
      frequencySeconds: opts.frequencySeconds,
      regions: ['us-east'],
    })
    entry.commentBefore = ' alertChannels: [REPLACE_ME]   # route failures somewhere: devhelm alert-channels list'
    if (doc.has('monitors')) doc.addIn(['monitors'], entry)
    else doc.set('monitors', doc.createNode([entry]))
    writeFileSync(yamlFile, doc.toString())
    wrote.push(relative(opts.dir, yamlFile))
  }
  return {wrote, checkFile, yamlFile}
}

/** Append `.devhelm/` to .gitignore (once). */
export function ignoreStateDir(dir: string): boolean {
  const file = join(dir, '.gitignore')
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === '.devhelm/' || l.trim() === '.devhelm')) return false
  appendFileSync(file, `${text.length > 0 && !text.endsWith('\n') ? '\n' : ''}.devhelm/\n`)
  return true
}

export function installSkills(host: Host, cwd: string): string {
  const root = resolveSkillsDir()
  const dst = installTarget(host, 'project', cwd)
  for (const skill of listSkills(root)) copyDir(join(root, skill), join(dst, skill))
  return dst
}

/** The starter prompt: no secrets, ever. */
export function starterPrompt(opts: {repo?: string; name: string; kind: StarterKind; checkFile: string}): string {
  return [
    `Use the devhelm-configure skill.${opts.repo ? ` Repo ${opts.repo}.` : ''}`,
    `Make the ${opts.kind === 'browser' ? 'browser' : 'API'} check "${opts.name}" in ${opts.checkFile} test the real journey.`,
    'Run `devhelm validate --online`, then `devhelm test` until it passes.',
    'Ask me for any secret values and show me the `devhelm secrets values set` command; never print or handle secret values.',
    'Then run `devhelm deploy` and show me the changes before confirming.',
  ].join(' ')
}

/** pbcopy / clip / wl-copy / xclip; false when none worked. */
export function copyToClipboard(text: string): boolean {
  const candidates: Array<[string, string[]]> = process.platform === 'darwin'
    ? [['pbcopy', []]]
    : process.platform === 'win32'
      ? [['clip', []]]
      : [['wl-copy', []], ['xclip', ['-selection', 'clipboard']]]
  for (const [cmd, args] of candidates) {
    const r = spawnSync(cmd, args, {input: text, stdio: ['pipe', 'ignore', 'ignore']})
    if (r.status === 0) return true
  }
  return false
}

export const CI_WORKFLOW = `name: devhelm
on:
  pull_request:
  push:
    branches: [main]
concurrency: { group: devhelm-\${{ github.ref }}, cancel-in-progress: false }
env: { DEVHELM_API_TOKEN: \${{ secrets.DEVHELM_API_TOKEN }} }
jobs:
  devhelm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: devhelmhq/setup-devhelm@v1
      - run: devhelm validate
      - if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false
        run: devhelm test --reporter github
      - if: github.ref == 'refs/heads/main'
        run: devhelm deploy --yes --lock-timeout 5m
      - if: github.ref == 'refs/heads/main'
        run: devhelm trigger --tag smoke --region all --max-runs 8
`

export function writeCiWorkflow(dir: string, force: boolean): string | undefined {
  const file = join(dir, '.github', 'workflows', 'devhelm.yml')
  if (existsSync(file) && !force) return undefined
  mkdirSync(dirname(file), {recursive: true})
  writeFileSync(file, CI_WORKFLOW)
  return relative(dir, file)
}
