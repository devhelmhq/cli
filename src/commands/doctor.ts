import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {Flags} from '@oclif/core'
import {apiGet, apiGetSingle} from '../lib/api-client.js'
import {schemas as apiSchemas} from '../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../lib/cli/command.js'
import {loadMetaSources} from '../lib/cli/meta.js'
import {runtimeCatalog} from '../lib/code/bundle.js'
import {DevhelmError, EXIT_CODES} from '../lib/errors.js'
import {keyNotices} from '../lib/key-notices.js'
import {findMonitorsByName, ownerLabel, resolveEnvironment} from '../lib/monitors/resolve.js'
import {configFiles, fileFlag} from '../lib/project/flags.js'
import {codeMonitors, loadProject} from '../lib/project/project.js'
import {parsePage} from '../lib/response-validation.js'
import {HOSTS, listSkills, resolveSkillsDir} from '../lib/skills.js'
import {usageLine} from '../lib/runs/usage.js'

interface Check {
  check: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
  fix?: string
}

export default class Doctor extends DevhelmCommand {
  static description =
    'Check this setup: token, scopes and expiry, org/workspace/plan headroom, per-monitor secrets, owners, ' +
    'runtime end of life, installed skills and the CI file. --handover lists what to revoke, rotate and transfer'

  static examples = ['<%= config.bin %> doctor', '<%= config.bin %> doctor -o json', '<%= config.bin %> doctor --handover']

  static flags = {
    ...commonFlags,
    file: fileFlag,
    handover: Flags.boolean({description: 'List keys to revoke, secrets to rotate and owners to transfer before handing the account over', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Doctor)
    const checks: Check[] = []
    const add = (c: Check) => checks.push(c)
    const files = configFiles(undefined, flags.file)
    const loaded = existsSync(files[0]!) ? loadProject(files) : undefined
    const handover: Record<string, unknown> = {}

    let client
    try {
      client = this.client()
    } catch (err) {
      if (!(err instanceof DevhelmError)) throw err
      add({check: 'token', status: 'fail', detail: err.message, fix: 'devhelm auth login'})
    }

    if (client) {
      const {me, entitlements} = await loadMetaSources(client)
      if (me) {
        const notices = keyNotices({scopes: me.key.scopes, expiresAt: me.key.expiresAt ?? null})
        add({check: 'token', status: notices.length > 0 ? 'warn' : 'ok', detail: `key ${me.key.name} (#${me.key.id}) · scopes ${me.key.scopes.join(', ')} · expires ${me.key.expiresAt ?? 'never'}${notices.length > 0 ? ` · ${notices.join('; ')}` : ''}`})
      } else {
        add({check: 'token', status: 'warn', detail: 'the token works but is not an API key (/auth/me does not describe it)'})
      }
      const meta = await this.loadMeta({org: loaded?.config?.org, workspace: loaded?.config?.workspace}).catch((e: unknown) => {
        add({check: 'org', status: 'fail', detail: e instanceof Error ? e.message : String(e)})
        return undefined
      })
      if (meta) add({check: 'org', status: 'ok', detail: `${meta.org?.name ?? 'unknown org'} · workspace ${meta.workspace?.name ?? 'default'} · ${meta.plan ?? 'unknown plan'}`})
      if (entitlements) {
        const tight: string[] = []
        for (const [k, used] of Object.entries(entitlements.usage)) {
          const limit = entitlements.entitlements[k]?.value
          if (limit !== undefined && limit > 0 && limit < Number.MAX_SAFE_INTEGER && used / limit >= 0.8) tight.push(`${k} ${used}/${limit}`)
        }
        add({check: 'plan headroom', status: tight.length > 0 ? 'warn' : 'ok', detail: tight.length > 0 ? `near limits: ${tight.join(', ')}` : 'within limits', fix: tight.length > 0 ? 'devhelm account entitlements' : undefined})
      }
      add({check: 'synthetics usage', status: 'ok', detail: (await usageLine(client, 0, 'runs')).line.replace(/^0 runs · /, '')})

      const catalog = await runtimeCatalog(client)
      for (const m of codeMonitors(loaded?.config ?? null)) {
        try {
          const env = m.environment ? await resolveEnvironment(client, m.environment) : undefined
          const found = (await findMonitorsByName(client, m.name, env?.id))[0]
          if (!found) {
            add({check: `monitor ${m.name}`, status: 'ok', detail: 'not deployed yet'})
            continue
          }
          const req = await apiGetSingle(client, `/api/v1/monitors/${found.id}/secret-requests`, apiSchemas.MonitorSecretRequestsDto)
          const missing = req.requests.filter((r) => r.readiness !== 'ready').map((r) => r.key)
          const ownerOk = loaded?.config?.project ? found.owner?.project === loaded.config.project : true
          const pin = (found.config as {runtimeId?: string | null}).runtimeId ?? undefined
          const runtime = pin ? catalog.find((c) => c.id === pin) : undefined
          const eol = runtime && (runtime.status === 'deprecated' || runtime.eolAt) ? `runtime ${runtime.id} ${runtime.status}${runtime.eolAt ? `, end of life ${runtime.eolAt}` : ''}` : ''
          const problems = [missing.length > 0 ? `missing secret values: ${missing.join(', ')}` : '', ownerOk ? '' : `owned by ${ownerLabel(found)}`, eol].filter(Boolean)
          add({
            check: `monitor ${m.name}`,
            status: missing.length > 0 || !ownerOk ? 'fail' : eol ? 'warn' : 'ok',
            detail: problems.length > 0 ? problems.join(' · ') : `owner ${ownerLabel(found)} · secrets complete`,
            fix: missing.length > 0 ? `printf %s "$${missing[0]}" | devhelm secrets values set ${missing[0]} --env ${m.environment} --value-stdin` : !ownerOk ? `devhelm import monitor "${m.name}"` : undefined,
          })
        } catch (err) {
          if (!(err instanceof DevhelmError)) throw err
          add({check: `monitor ${m.name}`, status: 'warn', detail: err.message})
        }
      }

      if (flags.handover) {
        const keys = parsePage(apiSchemas.ApiKeyDto, await apiGet(client, '/api/v1/api-keys'), 'GET /api/v1/api-keys').data
        const secrets = parsePage(apiSchemas.SecretDto, await apiGet(client, '/api/v1/secrets'), 'GET /api/v1/secrets').data
        handover.keysToRevoke = keys.filter((k) => !k.revokedAt).map((k) => ({id: k.id, name: k.name, command: `devhelm api-keys revoke ${k.id}`}))
        handover.secretsToRotate = secrets.map((s) => ({key: s.key, command: `devhelm secrets values set ${s.key} --env <slug> --value-stdin`}))
        handover.ownersToTransfer = codeMonitors(loaded?.config ?? null).map((m) => ({monitor: m.name, command: `devhelm monitors transfer "${m.name}" --to dashboard --reason "handover"`}))
      }
    }

    add(this.skillsCheck())
    const ci = ['.github/workflows'].map((d) => join(process.cwd(), d)).filter((d) => existsSync(d))
    const ciFile = ci.flatMap((d) => readdirSync(d).map((f) => join(d, f))).find((f) => /devhelm/.test(readFileSync(f, 'utf8')))
    add({check: 'ci', status: ciFile ? 'ok' : 'warn', detail: ciFile ? ciFile.replace(`${process.cwd()}/`, '') : 'no CI workflow runs devhelm', fix: ciFile ? undefined : 'devhelm init --browser <name> --ci github'})

    const failed = checks.some((c) => c.status === 'fail')
    await this.finish({
      exit: failed ? EXIT_CODES.VALIDATION : EXIT_CODES.SUCCESS,
      data: {checks, ...(flags.handover ? {handover} : {})},
      human: () => {
        for (const c of checks) {
          this.log(`${c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '✗'} ${c.check}: ${c.detail}`)
          if (c.fix) this.log(`    fix: ${c.fix}`)
        }
        if (flags.handover) this.log(`\nHandover:\n${JSON.stringify(handover, null, 2)}`)
      },
    })
  }

  /** Installed project skills that differ from this CLI's bundled copy are stale. */
  private skillsCheck(): Check {
    const root = resolveSkillsDir()
    const stale: string[] = []
    let installed = 0
    for (const host of Object.values(HOSTS)) {
      const dir = join(process.cwd(), host.project)
      if (!existsSync(dir)) continue
      for (const skill of listSkills(root)) {
        const mine = join(dir, skill, 'SKILL.md')
        if (!existsSync(mine)) continue
        installed++
        if (readFileSync(mine, 'utf8') !== readFileSync(join(root, skill, 'SKILL.md'), 'utf8')) stale.push(`${host.project}/${skill}`)
      }
    }
    if (installed === 0) return {check: 'skills', status: 'ok', detail: 'none installed in this repo'}
    return stale.length > 0
      ? {check: 'skills', status: 'warn', detail: `differ from this CLI (${this.config.version}): ${stale.join(', ')}`, fix: 'devhelm skills install'}
      : {check: 'skills', status: 'ok', detail: `${installed} installed, current with CLI ${this.config.version}`}
  }
}
