import {Args, Flags} from '@oclif/core'
import {prepareCode, runtimeCatalog} from '../lib/code/bundle.js'
import {DevhelmCommand, commonFlags} from '../lib/cli/command.js'
import {parseDurationMs} from '../lib/cli/flags.js'
import {EXIT_CODES, ValidationError} from '../lib/errors.js'
import {configFiles, fileFlag, projectOutputFlag} from '../lib/project/flags.js'
import {uploadPrepared} from '../lib/project/online.js'
import {formatIssue, loadProject, prepareCodeMonitors} from '../lib/project/project.js'
import {readTerraformTargets} from '../lib/project/terraform.js'
import {exitForItems, resolveTargets, runTargets, selectTargets, type TestTarget} from '../lib/project/test-runner.js'
import {reporterOutput, type ReportItem} from '../lib/reporters/index.js'
import {failureLines, runLine} from '../lib/runs/outcome.js'
import {sessionContext} from '../lib/runs/session.js'
import {billedCount, usageLine} from '../lib/runs/usage.js'
import {readStateOrThrow} from '../lib/project/pipeline.js'
import {createProjectContext, type ProjectContext} from '../lib/yaml/project-context.js'

export default class Test extends DevhelmCommand {
  static strict = false
  static description =
    'Run validation runs from local files: code monitors bundle and run in their environment, uptime monitors run the probe. ' +
    'Runs are saved and billed, and never alert. Exit 14 if a run failed, 19 if no verdict, else 0'

  static examples = [
    '<%= config.bin %> test',
    '<%= config.bin %> test Checkout --region eu-west',
    '<%= config.bin %> test synthetics/checkout.spec.ts',
    '<%= config.bin %> test --reporter github',
    '<%= config.bin %> test --repeat 5 Checkout',
    '<%= config.bin %> test --from-terraform ./infra',
  ]

  static args = {
    targets: Args.string({description: 'Monitor names or entry file paths (default: every monitor in devhelm.yml)'}),
  }

  static flags = {
    ...commonFlags,
    output: projectOutputFlag,
    file: fileFlag,
    env: Flags.string({description: 'Only monitors in this environment (slug)'}),
    region: Flags.string({description: 'Region to run in (repeatable; default: the first region)', multiple: true}),
    timeout: Flags.string({description: 'How long to wait for runs (default 10m); runs keep going after it', default: '10m'}),
    detach: Flags.boolean({description: 'Start the runs and exit without waiting (alias --no-wait)', default: false, aliases: ['no-wait']}),
    repeat: Flags.integer({description: 'Run each check N times per region (1–10); prints the cost first', default: 1, min: 1}),
    reporter: Flags.string({description: 'Report format: junit (XML), github (annotations + job summary) or json', options: ['junit', 'github', 'json']}),
    'fail-on-infra-error': Flags.boolean({description: 'Fail (exit 19) when a run reaches no verdict (default true)', default: true, allowNo: true}),
    session: Flags.string({description: 'Group these runs under a session id (default: the CI run)'}),
    'from-terraform': Flags.string({description: 'Test the devhelm_monitor resources of a saved Terraform plan in this directory'}),
    concurrency: Flags.integer({description: 'Runs started in parallel', default: 5, min: 1}),
  }

  async run() {
    const {argv, flags} = await this.parse(Test)
    if (flags.repeat > 10) throw new ValidationError('--repeat is at most 10', {code: 'FIELD_INVALID_FORMAT'})
    const timeoutMs = parseDurationMs(flags.timeout, 'timeout')
    const selectors = (argv as string[]).filter(Boolean)
    const reporter = flags.reporter
    if (reporter === 'json') this.format = 'json'
    const quiet = reporter === 'junit' || reporter === 'github'

    let targets: TestTarget[]
    const client = this.client()
    let pins: {org?: string; workspace?: string} = {}
    let ctx: ProjectContext

    if (flags['from-terraform']) {
      const tf = readTerraformTargets(flags['from-terraform'])
      const catalog = await runtimeCatalog(client)
      ctx = createProjectContext({configDir: flags['from-terraform']})
      targets = []
      for (const t of tf) {
        if (selectors.length > 0 && !selectors.includes(t.monitor.name) && !selectors.includes(t.address)) continue
        if (t.monitor.code !== undefined) {
          const pin = (t.monitor.config as {runtimeId?: string} | undefined)?.runtimeId
          const runtime = catalog.find((c) => c.id === pin) ?? null
          ctx.code.set(t.monitor.name, {prepared: await prepareCode(t.monitor.code, {baseDir: t.root, root: t.root, runtime})})
        }
        targets.push({name: t.monitor.name, type: t.monitor.type, monitor: t.monitor, environmentId: t.environmentId, file: t.address})
      }
    } else {
      const files = configFiles(undefined, flags.file)
      const loaded = loadProject(files)
      const errors = loaded.issues.filter((i) => i.severity === 'error')
      if (!loaded.config || errors.length > 0) {
        throw new ValidationError(`${files.join(', ')} is not valid:\n${errors.map((e) => `  ${formatIssue(e)}`).join('\n')}`, {code: 'CONFIG_INVALID'})
      }
      pins = {org: loaded.config.org, workspace: loaded.config.workspace}
      const {targets: picked, unknown} = selectTargets(loaded.config.monitors ?? [], selectors, {env: flags.env, configDir: loaded.configDir})
      if (unknown.length > 0) {
        throw new ValidationError(`No monitor in ${files.join(', ')} matches: ${unknown.join(', ')}`, {code: 'NO_MATCHING_MONITORS'})
      }
      if (picked.length === 0) throw new ValidationError('No monitors selected', {code: 'NO_MATCHING_MONITORS'})
      const catalog = await runtimeCatalog(client)
      const {issues} = await prepareCodeMonitors(loaded, catalog, new Set(picked.map((m) => m.name)))
      const codeErrors = issues.filter((i) => i.severity === 'error')
      if (codeErrors.length > 0) {
        throw new ValidationError(`Code refused:\n${codeErrors.map((e) => `  ${formatIssue(e)}`).join('\n')}`, {code: codeErrors[0]!.code ?? 'BUNDLE_INVALID'})
      }
      ctx = loaded.ctx
      targets = await resolveTargets(client, picked, {state: readStateOrThrow(), configDir: loaded.configDir, ctx})
    }

    await this.loadMeta(pins)
    if (!this.structured && !quiet) await this.header()

    const codeTargets = targets.filter((t) => ctx.code.has(t.name))
    if (codeTargets.length > 0) {
      if (!this.structured && !quiet) this.log(`Bundling ${codeTargets.length} check${codeTargets.length === 1 ? '' : 's'} …`)
      const refused = await uploadPrepared(client, ctx, new Set(codeTargets.map((t) => t.name)))
      if (refused.length > 0 && refused.length === codeTargets.length && targets.length === codeTargets.length) {
        throw new ValidationError(`Upload refused:\n${refused.map((e) => `  ${formatIssue(e)}`).join('\n')}`, {code: refused[0]!.code ?? 'BUNDLE_INVALID'})
      }
    }

    const regionsPerRun = Math.max(1, flags.region?.length ?? 1)
    const planned = codeTargets.length * regionsPerRun * flags.repeat
    if (flags.repeat > 1 && !this.structured && !quiet) {
      this.log(`${codeTargets.length} check(s) × ${regionsPerRun} region(s) × ${flags.repeat} = ${planned} runs will be billed`)
    }

    const items = await runTargets(client, targets, {
      ctx,
      regions: flags.region,
      repeat: flags.repeat,
      session: sessionContext(flags.session),
      wait: !flags.detach,
      timeoutMs,
      concurrency: flags.concurrency,
      onEvent: (t, e) => {
        if (flags.verbose && !this.structured) this.logToStderr(`  ${t.name}: ${e.type}${stepTitle(e) ? ` ${stepTitle(e)}` : ''}`)
      },
      onItem: (i) => {
        if (!this.structured && !quiet) this.printItem(i)
      },
    })

    const runs = items.map((i) => i.run)
    const billed = billedCount(runs)
    const usage = await usageLine(client, billed)
    let exit = exitForItems(items, {failOnInfraError: flags['fail-on-infra-error']})
    if (flags.detach && exit === EXIT_CODES.NO_VERDICT && items.every((i) => i.kind !== 'error')) exit = EXIT_CODES.SUCCESS
    const passed = items.filter((i) => i.verdict === 'passed' && i.kind !== 'not_applicable').length
    const failed = items.filter((i) => i.verdict === 'failed').length
    const noVerdict = items.filter((i) => i.verdict === 'no_verdict' || i.verdict === 'pending').length
    const summary = [
      `${passed} passed`,
      failed > 0 ? `${failed} failed` : '',
      noVerdict > 0 ? `${noVerdict} ${flags.detach ? 'started' : 'without a verdict'}` : '',
    ].filter(Boolean).join(', ') + (flags.repeat > 1 ? ` (passed ${passed}/${items.length})` : '') + ` · ${usage.line}`
    if (!flags['fail-on-infra-error'] && noVerdict > 0) this.warnings.push('no-verdict runs did not fail the command (--no-fail-on-infra-error)')

    const report = reporterOutput(reporter, items, `${summary}${exit !== 0 ? `          (exit ${exit})` : ''}`)
    if (report !== undefined) {
      this.log(report)
      if (exit !== 0) this.exit(exit)
      return
    }
    await this.finish({
      exit,
      data: {results: items.map(serializeItem), billedRuns: billed, remaining: usage.remaining, summary},
      human: () => this.log(`${summary}${exit !== 0 ? `          (exit ${exit})` : ''}`),
    })
  }

  private printItem(i: ReportItem): void {
    const label = i.kind === 'probe' ? `${i.name} (probe)` : i.name
    if (i.kind === 'not_applicable') {
      this.log(`  - ${label}  not applicable (${i.type})`)
      return
    }
    if (i.kind === 'error') {
      this.log(`  ✗ ${label}${i.region ? `  ${i.region}` : ''}  [${i.error?.code ?? i.error?.category}] ${i.error?.message}`)
      return
    }
    if (i.kind === 'probe') {
      const p = i.probe!
      this.log(`  ${p.passed ? '✓' : '✗'} ${label}  ${p.responseTimeMs ?? ''}${p.responseTimeMs !== null && p.responseTimeMs !== undefined ? ' ms' : ''}${p.passed ? '' : ` · ${p.error ?? `HTTP ${p.statusCode ?? '?'}`}`}`)
      return
    }
    const run = i.run!
    this.log(`  ▸ ${label}${i.attempt && i.attempt > 1 ? ` #${i.attempt}` : ''}  ${i.type === 'BROWSER' ? 'browser' : 'API'}`)
    this.log(`    ${runLine(run)}`)
    if (i.verdict !== 'passed') for (const l of failureLines(run)) this.log(`      ${l}`)
  }
}

function stepTitle(e: {payload: Record<string, unknown>}): string {
  const t = e.payload.title
  return typeof t === 'string' ? t : ''
}

function serializeItem(i: ReportItem) {
  return {
    name: i.name,
    type: i.type,
    kind: i.kind,
    region: i.region ?? i.run?.region ?? null,
    attempt: i.attempt ?? 1,
    verdict: i.verdict,
    run: i.run ?? null,
    probe: i.probe ?? null,
    error: i.error ?? null,
  }
}

