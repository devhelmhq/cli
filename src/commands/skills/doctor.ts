import {Command, Flags} from '@oclif/core'
import {existsSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {globalFlags} from '../../lib/base-command.js'
import {resolveToken, resolveApiUrl} from '../../lib/auth.js'
import {detectHosts, HOSTS, installTarget, listSkills, resolveSkillsDir, SKILL_NAMES} from '../../lib/skills.js'

type Check = {name: string; status: 'ok' | 'warn' | 'fail'; detail: string}

export default class SkillsDoctor extends Command {
  static override description =
    'Diagnose DevHelm skills installation — verifies the CLI is installed, authenticated, skills are on disk, and at least one host has them loaded.'

  static override examples = ['<%= config.bin %> skills doctor', '<%= config.bin %> skills doctor --path=./my-project']

  static override flags = {
    ...globalFlags,
    path: Flags.string({description: 'Project path to check (default: cwd)'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsDoctor)
    const checks: Check[] = []

    // 1. Bundled skills present in the package.
    let skillsRoot: string | null = null
    try {
      skillsRoot = resolveSkillsDir()
      const installed = listSkills(skillsRoot)
      const missing = SKILL_NAMES.filter((n) => !installed.includes(n))
      if (missing.length === 0) {
        checks.push({name: 'Bundled skills', status: 'ok', detail: `${installed.length} skill(s) present`})
      } else {
        checks.push({
          name: 'Bundled skills',
          status: 'fail',
          detail: `Missing in package: ${missing.join(', ')}`,
        })
      }
    } catch (err) {
      checks.push({name: 'Bundled skills', status: 'fail', detail: (err as Error).message})
    }

    // 2. Authentication.
    const token = resolveToken()
    const apiUrl = resolveApiUrl()
    checks.push(
      token
        ? {name: 'Authentication', status: 'ok', detail: `Token found; API URL: ${apiUrl}`}
        : {
            name: 'Authentication',
            status: 'fail',
            detail: 'No API token. Run `devhelm auth login`.',
          },
    )

    // 3. Host directories — at least one should contain our skills.
    if (skillsRoot) {
      const cwd = flags.path ?? process.cwd()
      const hits: string[] = []
      for (const host of Object.keys(HOSTS) as Array<keyof typeof HOSTS>) {
        for (const scope of ['project', 'global'] as const) {
          const candidate = installTarget(host, scope, cwd)
          for (const skill of SKILL_NAMES) {
            const path = join(candidate, skill, 'SKILL.md')
            if (existsSync(path) && statSync(path).isFile()) {
              hits.push(`${host}:${scope} → ${candidate}`)
              break
            }
          }
        }
      }
      if (hits.length === 0) {
        checks.push({
          name: 'Host install',
          status: 'warn',
          detail: 'Skills are bundled but not yet installed to any agent host. Run `devhelm skills install`.',
        })
      } else {
        checks.push({
          name: 'Host install',
          status: 'ok',
          detail: `Found in: ${hits.join('; ')}`,
        })
      }
    }

    // 4. Detected hosts (informational).
    const detected = detectHosts()
    checks.push({
      name: 'Detected agent hosts',
      status: 'ok',
      detail: detected.length === 1 && detected[0] === 'generic' ? 'None detected — will install to generic .skills/' : detected.join(', '),
    })

    // Output.
    const longest = Math.max(...checks.map((c) => c.name.length))
    for (const c of checks) {
      const mark = c.status === 'ok' ? 'ok  ' : c.status === 'warn' ? 'warn' : 'fail'
      this.log(`[${mark}] ${c.name.padEnd(longest)}  ${c.detail}`)
    }

    const anyFail = checks.some((c) => c.status === 'fail')
    this.log('')
    if (anyFail) {
      this.log('Skill setup has blocking issues. Fix the failures above, then rerun.')
      this.exit(1)
    } else {
      this.log('Skills look healthy. Prompt your agent for something like:')
      this.log('  > Set up a monitor for https://your-site.com.')
    }
  }
}
