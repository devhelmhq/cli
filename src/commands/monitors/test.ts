import {readFileSync, existsSync} from 'node:fs'
import {extname, resolve} from 'node:path'
import {Args, Flags} from '@oclif/core'
import {parse as parseYaml} from 'yaml'
import {checkedFetch, checkedFetchWithStatus, unwrapData, type ApiClient} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, parseDurationMs} from '../../lib/cli/flags.js'
import {ValidationError, EXIT_CODES} from '../../lib/errors.js'
import {queuedRunFrom} from '../../lib/monitor-test.js'
import {codeFromFlag} from '../../lib/monitors/code-flag.js'
import {isCodeType, resolveMonitor} from '../../lib/monitors/resolve.js'
import {formatOutput} from '../../lib/output.js'
import {parse} from '../../lib/response-validation.js'
import {followRuns} from '../../lib/runs/follow.js'
import {sessionContext} from '../../lib/runs/session.js'

export default class MonitorsTest extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Test a monitor once. Browser and multi-step API monitors run a validation run (billed, never alerts) and wait for it; uptime monitors run the probe. --code tests a local file against the saved monitor. --config <file> validates a proposed config without saving it. Exit 14 when the check fails, 19 when no verdict was reached.'
  static examples = [
    '<%= config.bin %> monitors test Checkout --env production',
    '<%= config.bin %> monitors test Checkout --code synthetics/checkout.spec.ts --region eu-west',
    '<%= config.bin %> monitors test <id> --no-wait',
    '<%= config.bin %> monitors test --config monitor.yml',
  ]
  static args = {
    id: Args.string({description: 'Monitor id or exact name', required: false}),
  }
  static flags = {
    ...commonFlags,
    env: envFlag,
    config: Flags.string({
      description:
        'Path to a YAML or JSON file containing a CreateMonitorRequest payload to validate (and dry-run, when no id is given)',
    }),
    code: Flags.string({description: 'Code monitors: test this local entry file against the saved monitor'}),
    region: Flags.string({description: "Code monitors: region for the validation run (default: the monitor's first region)"}),
    session: Flags.string({description: 'Group this run under a test session id (default: the CI run)'}),
    wait: Flags.boolean({description: 'Wait for the run to finish (default true; --no-wait returns at once)', default: true, allowNo: true}),
    detach: Flags.boolean({description: 'Alias of --no-wait', default: false}),
    timeout: Flags.string({description: 'How long to wait for the run (default 5m); the run keeps going after it', default: '5m'}),
    'fail-on-infra-error': Flags.boolean({description: 'Exit 19 when no verdict was reached (default true)', default: true, allowNo: true}),
    'environment-id': Flags.string({hidden: true, deprecated: {message: '--environment-id is deprecated since 1.12 and removed 2027-01-31: a test runs in the monitor\'s own environment'}}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsTest)
    const id = args.id

    if (id && flags.config) {
      this.error(
        'Pass either a monitor id (live test against an existing monitor) or --config <file> (validate a proposed config), not both.',
        {exit: EXIT_CODES.VALIDATION},
      )
    }
    if (flags.config && (flags.region !== undefined || flags.code !== undefined)) {
      this.error('--region and --code apply to a saved monitor, not --config.', {exit: EXIT_CODES.VALIDATION})
    }
    if (!id && !flags.config) {
      this.error(
        'Pass a monitor id to run a live test, or --config <file> to validate a proposed monitor configuration.',
        {exit: EXIT_CODES.VALIDATION},
      )
    }

    const client = this.client()

    if (flags.config) {
      await this.runConfigCheck(flags.config, client)
      return
    }

    const monitor = await resolveMonitor(client, id as string, {env: flags.env})

    if (monitor.type === 'HEARTBEAT') {
      await this.finish({
        data: {monitorId: monitor.id, outcome: 'not_applicable'},
        human: () => this.log(`${monitor.name}: not_applicable (heartbeat monitors are pushed, not probed)`),
      })
      return
    }

    if (!isCodeType(monitor.type)) {
      if (flags.code) throw new ValidationError('--code applies to BROWSER and MULTI_STEP_API monitors', {code: 'FIELD_UNKNOWN'})
      process.stderr.write('Running test...\n')
      const {data} = await checkedFetchWithStatus(client.POST('/api/v1/monitors/{id}/test', {params: {path: {id: monitor.id}}}))
      const probe = unwrapData(data) as {passed?: unknown}
      await this.finish({
        exit: probe.passed === false ? EXIT_CODES.CHECK_FAILED : 0,
        data: probe,
        human: () => this.log(formatOutput(probe, 'table')),
      })
      return
    }

    const body: Record<string, unknown> = {}
    if (flags.region) body.region = flags.region
    if (flags['environment-id']) body.environmentId = flags['environment-id']
    if (flags.code) body.code = await codeFromFlag(client, flags.code)
    const session = sessionContext(flags.session)
    if (session) body.session = session
    const target = Object.keys(body).length > 0 ? parse(apiSchemas.CodeTestTargetRequest, body, 'Invalid monitor test target') : undefined
    const {status, data} = await checkedFetchWithStatus(
      client.POST('/api/v1/monitors/{id}/test', {params: {path: {id: monitor.id}}, ...(target ? {body: target} : {})}),
    )
    const run = queuedRunFrom(status, data, `POST /api/v1/monitors/${monitor.id}/test`)
    if (!run) {
      await this.finish({data: unwrapData(data), human: () => this.log(formatOutput(unwrapData(data), 'table'))})
      return
    }
    process.stderr.write(`Queued validation run ${run.id} in ${run.region}. It does not affect monitor health.\n`)
    const wait = flags.wait && !flags.detach
    const followed = await followRuns(client, [run], {
      wait,
      timeoutMs: parseDurationMs(flags.timeout, 'timeout'),
      failOnInfraError: flags['fail-on-infra-error'],
      log: this.structured ? undefined : (l) => this.log(l),
    })
    for (const w of followed.warnings) this.addWarning(w)
    const finalRun = followed.runs[0]
    await this.finish({exit: followed.exit, data: finalRun})
  }

  // Validates the file locally against `CreateMonitorRequest`; if the
  // shape is valid, also dispatches a `MonitorTestRequest` (the
  // server-supported subset) to `/api/v1/monitors/test` so the user
  // sees a real probe result for the proposed config — same data they'd
  // get from `monitors test <id>` after persisting.
  private async runConfigCheck(
    path: string,
    client: ApiClient,
  ): Promise<void> {
    const parsed = readConfigFile(path)

    const result = apiSchemas.CreateMonitorRequest.safeParse(parsed)
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.length > 0 ? i.path.join('.') : '<root>'}: ${i.message}`)
        .join('\n')
      this.error(`Config '${path}' failed CreateMonitorRequest validation:\n${issues}`, {
        exit: EXIT_CODES.VALIDATION,
      })
    }

    process.stderr.write(`✓ Config '${path}' is valid against CreateMonitorRequest.\n`)

    // The dry-run endpoint only accepts the test subset of the create
    // request; strip the persistence-only fields (`name`, `frequencySeconds`,
    // `regions`, …) before posting. The MonitorTestRequest schema parse
    // catches anything that doesn't pass through cleanly.
    const testBody: Record<string, unknown> = {
      type: result.data.type,
      config: result.data.config,
    }
    if (result.data.assertions) testBody.assertions = result.data.assertions

    const testParse = apiSchemas.MonitorTestRequest.safeParse(testBody)
    if (!testParse.success) {
      this.warn(
        'Skipping probe dispatch — could not derive a MonitorTestRequest from the config. ' +
        'The config validates as a CreateMonitorRequest but contains shape variants the test endpoint does not accept.',
      )
      return
    }

    process.stderr.write('Dispatching probe simulation against /api/v1/monitors/test...\n')
    const resp = await checkedFetch(
      client.POST('/api/v1/monitors/test', {body: testParse.data}),
    )
    const probe = unwrapData(resp) as {passed?: unknown}
    await this.finish({
      exit: probe.passed === false ? EXIT_CODES.CHECK_FAILED : 0,
      data: probe,
      human: () => this.log(formatOutput(probe, 'table')),
    })
  }
}

// Reads the file and parses it as YAML or JSON based on extension. JSON
// is round-tripped through `parseYaml` (yaml is a strict superset of
// JSON) so `.json`, `.yml`, `.yaml`, and extension-less files all work.
// Returns `unknown` so the caller can hand the value straight to the
// Zod safe-parser without an `as any`.
function readConfigFile(path: string): unknown {
  const absPath = resolve(path)
  if (!existsSync(absPath)) {
    throw new ValidationError(`Config file not found: ${path}`)
  }

  const raw = readFileSync(absPath, 'utf8')
  const ext = extname(absPath).toLowerCase()

  try {
    if (ext === '.json') {
      return JSON.parse(raw) as unknown
    }
    return parseYaml(raw) as unknown
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new ValidationError(
      `Failed to parse '${path}' as ${ext === '.json' ? 'JSON' : 'YAML'}: ${msg}`,
    )
  }
}
