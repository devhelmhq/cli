import {readFileSync, existsSync} from 'node:fs'
import {extname, resolve} from 'node:path'
import {Args, Command, Flags} from '@oclif/core'
import {parse as parseYaml} from 'yaml'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch, unwrapData} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmValidationError, EXIT_CODES} from '../../lib/errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default class MonitorsTest extends Command {
  static description =
    'Run an ad-hoc test for a monitor. Pass an existing id, or use --config <file> to validate a proposed config (YAML or JSON) without persisting it.'
  static examples = [
    '<%= config.bin %> monitors test 42',
    '<%= config.bin %> monitors test --config monitor.yml',
    '<%= config.bin %> monitors test --config monitor.json --output json',
  ]
  // The id arg is now optional because `--config` is an alternative
  // entry point. We can't reuse `uuidArg` here (it pins `required: true`),
  // so we run the UUID format check inline once we know which mode the
  // user picked.
  static args = {
    id: Args.string({description: 'Monitor ID', required: false}),
  }
  static flags = {
    ...globalFlags,
    config: Flags.string({
      description:
        'Path to a YAML or JSON file containing a CreateMonitorRequest payload to validate (and dry-run, when no id is given)',
    }),
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
    if (!id && !flags.config) {
      this.error(
        'Pass a monitor id to run a live test, or --config <file> to validate a proposed monitor configuration.',
        {exit: EXIT_CODES.VALIDATION},
      )
    }

    const client = buildClient(flags)

    if (flags.config) {
      await this.runConfigCheck(flags.config, flags.output, client)
      return
    }

    if (!UUID_RE.test(id as string)) {
      this.error(
        `Invalid UUID format: got '${id}', expected xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
        {exit: EXIT_CODES.VALIDATION},
      )
    }

    this.log('Running test...')
    const resp = await checkedFetch(
      client.POST('/api/v1/monitors/{id}/test', {params: {path: {id: id as string}}}),
    )
    display(this, unwrapData(resp), flags.output)
  }

  // Validates the file locally against `CreateMonitorRequest`; if the
  // shape is valid, also dispatches a `MonitorTestRequest` (the
  // server-supported subset) to `/api/v1/monitors/test` so the user
  // sees a real probe result for the proposed config — same data they'd
  // get from `monitors test <id>` after persisting.
  private async runConfigCheck(
    path: string,
    outputFormat: string,
    client: ReturnType<typeof buildClient>,
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

    this.log(`✓ Config '${path}' is valid against CreateMonitorRequest.`)

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

    this.log('Dispatching probe simulation against /api/v1/monitors/test...')
    const resp = await checkedFetch(
      client.POST('/api/v1/monitors/test', {body: testParse.data}),
    )
    display(this, unwrapData(resp), outputFormat)
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
    throw new DevhelmValidationError(`Config file not found: ${path}`)
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
    throw new DevhelmValidationError(
      `Failed to parse '${path}' as ${ext === '.json' ? 'JSON' : 'YAML'}: ${msg}`,
    )
  }
}
