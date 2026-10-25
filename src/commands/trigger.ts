import {existsSync} from 'node:fs'
import {Args, Flags} from '@oclif/core'
import {apiGet, checkedFetch} from '../lib/api-client.js'
import {schemas as apiSchemas} from '../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../lib/cli/command.js'
import {parseDurationMs} from '../lib/cli/flags.js'
import {EXIT_CODES, ValidationError, WaitTimeoutError} from '../lib/errors.js'
import {isCodeType, resolveEnvironment, resolveMonitor, type MonitorDto} from '../lib/monitors/resolve.js'
import {configFiles, fileFlag, projectOutputFlag} from '../lib/project/flags.js'
import {loadProject} from '../lib/project/project.js'
import {exitForItems} from '../lib/project/test-runner.js'
import {githubReport, junitReport, type ReportItem} from '../lib/reporters/index.js'
import {registerStartedRun} from '../lib/runs/registry.js'
import {runSymbol, verdictOf} from '../lib/runs/outcome.js'
import {sessionContext} from '../lib/runs/session.js'
import {usageLine} from '../lib/runs/usage.js'
import {getRun, waitForRun, type RunDto} from '../lib/runs/wait.js'
import {parse, parsePage, parseSingle} from '../lib/response-validation.js'

export default class Trigger extends DevhelmCommand {
  static strict = false
  static description =
    'Start recorded runs of live code monitors, fanned out per region (POST /monitors/{id}/triggers). ' +
    'Runs are billed and never alert unless --signal. Exit 14 if any run failed'

  static examples = [
    '<%= config.bin %> trigger Checkout --region all',
    '<%= config.bin %> trigger --tag smoke --region all --max-runs 8',
    '<%= config.bin %> trigger Checkout --env production --signal',
  ]

  static args = {
    monitors: Args.string({description: 'Monitor ids or names (default: the code monitors in devhelm.yml)'}),
  }

  static flags = {
    ...commonFlags,
    output: projectOutputFlag,
    file: fileFlag,
    tag: Flags.string({description: 'Select monitors with this tag'}),
    env: Flags.string({description: 'Environment slug: narrows name resolution and selections'}),
    region: Flags.string({description: 'Region to run in (repeatable), or "all" for every configured region (default: the server default)', multiple: true}),
    signal: Flags.boolean({description: 'Let failures alert like scheduled runs (needs scope runs:signal)', default: false}),
    force: Flags.boolean({description: 'Run paused monitors too (never signals)', default: false}),
    'max-runs': Flags.integer({description: 'Refuse a selection that would start more runs (default 10)', default: 10, min: 1}),
    'min-regions-passing': Flags.integer({description: 'Pass when at least N regions passed for every monitor', min: 1}),
    detach: Flags.boolean({description: 'Start the runs and exit without waiting (alias --no-wait)', default: false, aliases: ['no-wait']}),
    timeout: Flags.string({description: 'How long to wait for runs (default 10m); runs keep going after it', default: '10m'}),
    'allow-empty': Flags.boolean({description: 'Exit 0 when nothing matches', default: false}),
    'fail-on-infra-error': Flags.boolean({description: 'Fail (exit 19) when a run reaches no verdict (default true)', default: true, allowNo: true}),
    reporter: Flags.string({description: 'Report format: junit, github or json', options: ['junit', 'github', 'json']}),
    session: Flags.string({description: 'Group these runs under a session id (default: the CI run)'}),
  }

  async run() {
    const {argv, flags} = await this.parse(Trigger)
    const client = this.client()
    const timeoutMs = parseDurationMs(flags.timeout, 'timeout')
    if (flags.signal && flags.force) throw new ValidationError('--force runs paused monitors without signalling; it cannot be combined with --signal', {code: 'FIELD_INVALID_FORMAT'})
    if (flags.reporter === 'json') this.format = 'json'
    const quiet = flags.reporter === 'junit' || flags.reporter === 'github'

    const selected = await this.select(argv as string[], flags)
    await this.loadMeta()
    if (selected.length === 0) {
      if (flags['allow-empty']) {
        await this.finish({data: {triggers: [], billedRuns: 0}, human: () => this.log('No monitors matched.')})
        return
      }
      throw new ValidationError('No monitors matched the selection', {code: 'NO_MATCHING_MONITORS'})
    }

    const code: MonitorDto[] = []
    for (const m of selected) {
      if (!isCodeType(m.type)) this.skipped.push({target: m.name, reason: `${m.type} monitors have no recorded runs; use \`devhelm monitors test\``, code: 'TRIGGER_UNSUPPORTED_TYPE'})
      else if ((m.pausedAt || m.enabled === false) && !flags.force) this.skipped.push({target: m.name, reason: 'paused (use --force to run it anyway)', code: 'MONITOR_PAUSED'})
      else code.push(m)
    }
    if (code.length === 0) {
      const only = this.skipped.every((s) => s.code === 'TRIGGER_UNSUPPORTED_TYPE')
      throw new ValidationError(only ? 'Trigger runs code monitors only; the selection has none' : 'Every selected monitor was skipped', {
        code: only ? 'TRIGGER_UNSUPPORTED_TYPE' : 'NO_MATCHING_MONITORS',
        details: {skipped: this.skipped.map((s) => ({target: s.target, reason: s.reason}))},
      })
    }

    const regionsFor = (m: MonitorDto): string[] | undefined => {
      if (!flags.region || flags.region.length === 0) return undefined
      return flags.region.includes('all') ? m.regions : flags.region
    }
    const planned = code.map((m) => ({m, regions: regionsFor(m) ?? m.regions}))
    const total = planned.reduce((n, p) => n + Math.max(1, p.regions.length), 0)
    if (total > flags['max-runs']) {
      throw new ValidationError(`This selection would start ${total} runs (more than --max-runs ${flags['max-runs']}): ${planned.map((p) => `${p.m.name} × ${p.regions.length}`).join(', ')}`, {
        code: 'MAX_RUNS_EXCEEDED',
        details: {runs: total, maxRuns: flags['max-runs'], monitors: planned.map((p) => ({name: p.m.name, regions: p.regions}))},
      })
    }

    if (!this.structured && !quiet) await this.header()
    const session = sessionContext(flags.session)
    const triggers: Array<{monitor: MonitorDto; response: {triggerId: string; billedRuns: number}; runs: RunDto[]}> = []
    let billed = 0
    for (const {m} of planned) {
      const body = parse(apiSchemas.TriggerRunRequest, {
        ...(regionsFor(m) ? {regions: regionsFor(m)} : {}),
        ...(flags.signal ? {signal: true} : {}),
        ...(session ? {session} : {}),
      }, 'Invalid trigger request')
      const resp = parseSingle(apiSchemas.TriggerRunsResponse, await checkedFetch(client.POST('/api/v1/monitors/{id}/triggers', {params: {path: {id: m.id}}, body})), `POST /api/v1/monitors/${m.id}/triggers`)
      billed += resp.billedRuns
      for (const r of resp.runs) registerStartedRun(client, r.id, r.phase)
      const runs = await Promise.all(resp.runs.map(async (r): Promise<RunDto> => {
        const first = await getRun(client, r.id)
        if (flags.detach) return first
        try {
          return await waitForRun(client, r.id, {timeoutMs})
        } catch (err) {
          if (!(err instanceof WaitTimeoutError)) throw err
          return {...first, phase: err.phase}
        }
      }))
      triggers.push({monitor: m, response: {triggerId: resp.triggerId, billedRuns: resp.billedRuns}, runs})
      if (!this.structured && !quiet) {
        const cells = runs.map((r) => `${r.region} ${runSymbol(r)} ${r.url ?? r.id}`).join('   ')
        const verdicts = runs.map(verdictOf)
        const sym = verdicts.includes('failed') ? '✗' : verdicts.every((v) => v === 'passed') ? '✓' : '?'
        this.log(`  ${sym} ${m.name}   ${cells}${flags.signal ? '' : '     recorded run · will not alert'}`)
      }
    }

    const items: ReportItem[] = triggers.flatMap((t) => t.runs.map((r) => ({
      name: t.monitor.name, type: t.monitor.type, kind: 'run' as const, region: r.region, run: r, verdict: verdictOf(r),
    })))
    let exit = exitForItems(items, {failOnInfraError: flags['fail-on-infra-error']})
    const minPassing = flags['min-regions-passing']
    if (minPassing !== undefined && exit === EXIT_CODES.CHECK_FAILED) {
      const enough = triggers.every((t) => t.runs.filter((r) => verdictOf(r) === 'passed').length >= minPassing)
      if (enough) exit = EXIT_CODES.SUCCESS
    }
    if (flags.detach && exit === EXIT_CODES.NO_VERDICT) exit = EXIT_CODES.SUCCESS
    const usage = await usageLine(client, billed)
    if (flags.reporter === 'junit') this.log(junitReport(items, 'devhelm trigger'))
    if (flags.reporter === 'github') {
      const ann = githubReport(items, usage.line)
      if (ann) this.log(ann)
      this.log(usage.line)
    }
    if (quiet) {
      if (exit !== 0) this.exit(exit)
      return
    }
    await this.finish({
      exit,
      data: {
        triggers: triggers.map((t) => ({monitor: {id: t.monitor.id, name: t.monitor.name}, triggerId: t.response.triggerId, billedRuns: t.response.billedRuns, runs: t.runs})),
        billedRuns: billed,
        remaining: usage.remaining,
        signal: flags.signal,
      },
      human: () => this.log(`${usage.line}${exit !== 0 ? `          (exit ${exit})` : ''}`),
    })
  }

  private async select(names: string[], flags: {tag?: string; env?: string; file?: string[]}): Promise<MonitorDto[]> {
    const client = this.client()
    const out = new Map<string, MonitorDto>()
    for (const n of names.filter(Boolean)) {
      const m = await resolveMonitor(client, n, {env: flags.env})
      out.set(m.id, m)
    }
    if (flags.tag) {
      const query: Record<string, string | number> = {tag: flags.tag, page: 0, size: 100}
      if (flags.env) query.environmentId = (await resolveEnvironment(client, flags.env)).id
      const page = parsePage(apiSchemas.MonitorDto, await apiGet(client, '/api/v1/monitors', {query}), 'GET /api/v1/monitors')
      for (const m of page.data) out.set(m.id, m)
    }
    if (names.filter(Boolean).length === 0 && !flags.tag) {
      const files = configFiles(undefined, flags.file)
      if (existsSync(files[0]!)) {
        const loaded = loadProject(files)
        for (const ym of loaded.config?.monitors ?? []) {
          if (flags.env && ym.environment !== flags.env) continue
          try {
            const m = await resolveMonitor(client, ym.name, {env: ym.environment ?? flags.env})
            out.set(m.id, m)
          } catch (err) {
            this.skipped.push({target: ym.name, reason: `not deployed (${err instanceof Error ? err.message : String(err)})`, code: 'MONITOR_NOT_FOUND'})
          }
        }
      }
    }
    return [...out.values()]
  }
}
