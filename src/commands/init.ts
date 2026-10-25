import {existsSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {Flags} from '@oclif/core'
import {apiGet} from '../lib/api-client.js'
import {schemas as apiSchemas} from '../lib/api-zod.generated.js'
import {resolveApiUrl, saveContext} from '../lib/auth.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../lib/cli/command.js'
import {loadMetaSources} from '../lib/cli/meta.js'
import {deviceLogin} from '../lib/device-login.js'
import {DevhelmError, EXIT_CODES} from '../lib/errors.js'
import {TEMPLATE} from '../lib/project/init-template.js'
import {
  DEFAULT_FREQUENCY, copyToClipboard, detectAgent, gitProject, ignoreStateDir, installSkills, starterPrompt,
  writeCiWorkflow, writeStarter, type StarterKind,
} from '../lib/project/init.js'
import {parsePage} from '../lib/response-validation.js'

export default class Init extends DevhelmCommand {
  static description =
    'Start a DevHelm project: a starter check and a plan-valid devhelm.yml entry (--browser / --api), skills for your agent, ' +
    'and an optional CI workflow. Never launches an agent; login is skippable'

  static examples = [
    '<%= config.bin %> init --browser Login',
    '<%= config.bin %> init --api "Orders API" --no-login',
    '<%= config.bin %> init --browser Checkout --agent claude-code --print-prompt',
    '<%= config.bin %> init --browser Login --ci github',
    '<%= config.bin %> init --path monitoring.yml',
  ]

  static flags = {
    ...commonFlags,
    ...yesFlag,
    browser: Flags.string({description: 'Add a browser check with this name', exclusive: ['api']}),
    api: Flags.string({description: 'Add a multi-step API check with this name', exclusive: ['browser']}),
    agent: Flags.string({description: 'Agent to install skills for (claude-code, cursor, codex, windsurf, gemini, generic)'}),
    skills: Flags.boolean({description: 'Install the DevHelm skills (default: when an agent is detected)', allowNo: true}),
    'print-prompt': Flags.boolean({description: 'Print the starter prompt for your agent', default: false}),
    'no-copy': Flags.boolean({description: 'Do not copy the starter prompt to the clipboard', default: false}),
    ci: Flags.string({description: 'Write a CI workflow', options: ['github']}),
    login: Flags.boolean({description: 'Log in with a device code (default on a terminal when not logged in)', allowNo: true}),
    'token-stdin': Flags.boolean({description: 'Read an API token from stdin and save it as the current context', default: false}),
    environment: Flags.string({description: 'Environment slug for the new check (default: the default environment)'}),
    path: Flags.string({description: 'devhelm.yml path', default: 'devhelm.yml'}),
    force: Flags.boolean({description: 'Re-create the starter check file (never rewrites existing monitors); without --browser/--api, overwrite devhelm.yml', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Init)
    const kind: StarterKind | undefined = flags.browser ? 'browser' : flags.api ? 'api' : undefined
    const name = flags.browser ?? flags.api

    if (!kind || !name) {
      // Pre-1.12 behaviour: write the annotated starter devhelm.yml.
      if (existsSync(flags.path) && !flags.force) {
        this.error(`${flags.path} already exists. Use --force to overwrite.`, {exit: EXIT_CODES.VALIDATION})
      }
      writeFileSync(flags.path, TEMPLATE)
      await this.finish({
        data: {wrote: [flags.path], next: [{cmd: 'devhelm validate'}]},
        human: () => {
          this.log(`Created ${flags.path}`)
          this.log('Edit the file, then run "devhelm validate" to check it.')
          this.log('When ready, run "devhelm deploy" to apply it to your DevHelm account.')
        },
      })
      return
    }

    const dir = dirname(resolve(flags.path))
    const repo = gitProject(dir)
    const agent = detectAgent(flags.agent)
    const mode = agent || this.nonInteractive ? 'agent' : 'human'
    const auth = await this.ensureLogin(flags)

    let frequencySeconds = DEFAULT_FREQUENCY
    let environment = flags.environment ?? 'production'
    let plan: string | null = null
    if (auth.loggedIn) {
      try {
        const {entitlements} = await loadMetaSources(this.client())
        plan = entitlements?.tier ?? null
        const floor = entitlements?.entitlements['code_check.min_frequency_seconds']?.value
        if (floor && floor > 0) frequencySeconds = Math.max(floor, 60)
        if (!flags.environment) {
          const envs = parsePage(apiSchemas.EnvironmentDto, await apiGet(this.client(), '/api/v1/environments', {query: {page: 0, size: 100}}), 'GET /api/v1/environments')
          environment = (envs.data.find((e) => e.isDefault) ?? envs.data[0])?.slug ?? environment
        }
      } catch (err) {
        if (!(err instanceof DevhelmError)) throw err
      }
    }

    const written = writeStarter({dir, yamlFile: resolve(flags.path), kind, name, project: repo, environment, frequencySeconds, force: flags.force})
    const wrote = [...written.wrote]
    if (ignoreStateDir(dir)) wrote.push('.gitignore')
    if (flags.ci === 'github') {
      const wf = writeCiWorkflow(dir, flags.force)
      if (wf) wrote.push(wf)
    }

    const installFor = flags.skills === false ? undefined : agent ?? (flags.skills ? 'generic' : undefined)
    const skillDir = installFor ? installSkills(installFor, dir) : undefined
    const checkRel = written.checkFile.slice(dir.length + 1)
    const prompt = starterPrompt({repo, name, kind, checkFile: checkRel})
    let copied = false
    if (skillDir && !flags['no-copy'] && !flags['print-prompt'] && !this.nonInteractive) copied = copyToClipboard(prompt)

    const next = auth.loggedIn
      ? [{cmd: 'devhelm test', needs: [kind === 'browser' ? 'BASE_URL' : 'API_URL']}, {cmd: 'devhelm deploy --yes', gated: 'human-confirm'}]
      : [{cmd: 'devhelm auth login', who: 'human'}]
    await this.finish({
      data: {
        mode,
        repo: repo ?? null,
        auth,
        plan,
        wrote,
        skill: skillDir ? {installed: [skillDir], agent: installFor} : null,
        prompt: flags['print-prompt'] || !copied ? prompt : null,
        next,
      },
      human: () => {
        this.log(`devhelm · repo: ${repo ?? 'no git remote'} · ${auth.loggedIn ? `logged in${plan ? ` · ${plan}` : ''}` : 'not logged in'}`)
        this.log(`✓ wrote ${written.wrote.join(' · ') || 'nothing new'}`)
        if (wrote.includes('.gitignore')) this.log('✓ .gitignore += .devhelm/')
        if (skillDir) this.log(`✓ installed skills → ${skillDir}`)
        if (copied) this.log('✓ prompt copied to clipboard: paste it into your agent')
        if (flags['print-prompt'] || (skillDir && !copied)) this.log(`\n${prompt}\n`)
        this.log(`Frequency: every ${frequencySeconds}s (plan floor) · environment: ${environment}`)
        this.log(`Next: ${next[0]!.cmd}`)
      },
    })
  }

  private async ensureLogin(flags: {login?: boolean; 'token-stdin': boolean; 'api-token'?: string; 'api-url'?: string}): Promise<{loggedIn: boolean; fix?: string}> {
    const apiUrl = flags['api-url'] ?? resolveApiUrl()
    if (flags['token-stdin']) {
      const token = readFileSync(0, 'utf8').trim()
      if (token) {
        saveContext({name: 'default', apiUrl, token}, true)
        process.env.DEVHELM_API_TOKEN = token
      }
    }
    try {
      this.client()
      return {loggedIn: true}
    } catch {
      // not logged in
    }
    const wantLogin = flags.login ?? (!this.nonInteractive)
    if (!wantLogin || this.nonInteractive) return {loggedIn: false, fix: 'human: devhelm auth login'}
    try {
      const result = await deviceLogin(apiUrl, {
        clientName: 'devhelm init',
        onPrompt: (a) => this.logToStderr(`Open ${a.verificationUriComplete} and confirm code ${a.userCode}`),
      })
      saveContext({name: 'default', apiUrl, token: result.token, orgId: result.orgId, workspaceId: result.workspaceId}, true)
      process.env.DEVHELM_API_TOKEN = result.token
      return {loggedIn: true}
    } catch (err) {
      this.addWarning(`Login skipped: ${err instanceof Error ? err.message : String(err)}`)
      return {loggedIn: false, fix: 'human: devhelm auth login'}
    }
  }
}
