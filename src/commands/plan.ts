import {Command, Flags} from '@oclif/core'
import {createApiClient} from '../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../lib/auth.js'
import {loadConfig, validate, fetchAllRefs, diff, formatPlan} from '../lib/yaml/index.js'
import {checkEntitlements, formatEntitlementWarnings} from '../lib/yaml/entitlements.js'

export default class Plan extends Command {
  static description = 'Show what "devhelm deploy" would change without applying'

  static examples = [
    '<%= config.bin %> plan',
    '<%= config.bin %> plan -f monitors.yml',
    '<%= config.bin %> plan --prune',
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

    const changeset = diff(config, refs, {prune: flags.prune})

    const entitlementCheck = await checkEntitlements(client, changeset)
    if (entitlementCheck) {
      this.log(entitlementCheck.header)
    }

    this.log(`\n${formatPlan(changeset)}`)

    if (entitlementCheck && entitlementCheck.warnings.length > 0) {
      this.log('')
      this.log(formatEntitlementWarnings(entitlementCheck.warnings))
    }

    const total = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length
    if (total > 0) {
      this.exit(2)
    }
  }
}
