import {Command, Flags} from '@oclif/core'
import {createApiClient} from '../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../lib/auth.js'
import {EXIT_CODES} from '../lib/errors.js'
import {loadConfig, validate, fetchAllRefs, diff, formatPlan, changesetToJson} from '../lib/yaml/index.js'
import {checkEntitlements, formatEntitlementWarnings} from '../lib/yaml/entitlements.js'

export default class Plan extends Command {
  static description = 'Show what "devhelm deploy" would change without applying'

  static examples = [
    '<%= config.bin %> plan',
    '<%= config.bin %> plan -f monitors.yml',
    '<%= config.bin %> plan --prune',
    '<%= config.bin %> plan --prune-all',
    '<%= config.bin %> plan --detailed-exitcode',
    '<%= config.bin %> plan -o json',
  ]

  static flags = {
    file: Flags.string({
      char: 'f',
      description: 'Config file or directory (can be specified multiple times)',
      multiple: true,
      default: ['devhelm.yml'],
    }),
    prune: Flags.boolean({
      description: 'Include deletions of CLI-managed resources not in config',
      default: false,
    }),
    'prune-all': Flags.boolean({
      description: 'Include deletions of ALL resources not in config, including those not managed by the CLI',
      default: false,
    }),
    'detailed-exitcode': Flags.boolean({
      description: 'Return exit code 10 if plan has changes (for CI)',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format (text or json)',
      options: ['text', 'json'],
      default: 'text',
    }),
    'api-url': Flags.string({description: 'Override API base URL'}),
    'api-token': Flags.string({description: 'Override API token'}),
    verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Plan)

    let config
    try {
      config = loadConfig(flags.file)
    } catch (err) {
      this.error((err as Error).message, {exit: 1})
    }

    const result = validate(config)
    if (result.errors.length > 0) {
      this.log(`\nValidation failed: ${result.errors.length} error(s)\n`)
      for (const e of result.errors) {
        this.log(`  ✗ ${e.path}: ${e.message}`)
      }
      this.error('Fix validation errors first', {exit: 4})
    }

    const token = flags['api-token'] ?? resolveToken()
    if (!token) {
      this.error('No API token configured. Run "devhelm auth login" or set DEVHELM_API_TOKEN.', {exit: 1})
    }

    const client = createApiClient({
      baseUrl: flags['api-url'] ?? resolveApiUrl(),
      token,
      verbose: flags.verbose,
    })

    this.log('Fetching current state from API...')
    const refs = await fetchAllRefs(client)

    const changeset = diff(config, refs, {prune: flags.prune || flags['prune-all'], pruneAll: flags['prune-all']})

    const entitlementCheck = await checkEntitlements(client, changeset)

    if (flags.output === 'json') {
      this.log(JSON.stringify(changesetToJson(changeset), null, 2))
    } else {
      if (entitlementCheck) {
        this.log(entitlementCheck.header)
      }

      this.log(`\n${formatPlan(changeset)}`)

      if (entitlementCheck && entitlementCheck.warnings.length > 0) {
        this.log('')
        this.log(formatEntitlementWarnings(entitlementCheck.warnings))
      }
    }

    const total = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length
    if (total > 0 && flags['detailed-exitcode']) {
      this.exit(EXIT_CODES.CHANGES_PENDING)
    }
  }
}
