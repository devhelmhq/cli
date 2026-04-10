import {Command, Flags} from '@oclif/core'
import {createApiClient} from '../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../lib/auth.js'
import {loadConfig, validate, fetchAllRefs, diff, formatPlan, apply, writeState, buildState} from '../lib/yaml/index.js'
import {checkEntitlements, formatEntitlementWarnings} from '../lib/yaml/entitlements.js'

export default class Deploy extends Command {
  static description = 'Deploy devhelm.yml configuration to the DevHelm API'

  static examples = [
    '<%= config.bin %> deploy',
    '<%= config.bin %> deploy --yes',
    '<%= config.bin %> deploy -f monitors.yml',
    '<%= config.bin %> deploy --prune --yes',
    '<%= config.bin %> deploy --dry-run',
  ]

  static flags = {
    file: Flags.string({
      char: 'f',
      description: 'Config file or directory (can be specified multiple times)',
      multiple: true,
      default: ['devhelm.yml'],
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt (for CI)',
      default: false,
    }),
    prune: Flags.boolean({
      description: 'Delete CLI-managed resources not present in config',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would change without applying (same as "devhelm plan")',
      default: false,
    }),
    'api-url': Flags.string({description: 'Override API base URL'}),
    'api-token': Flags.string({description: 'Override API token'}),
    verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Deploy)

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
      this.error('Fix validation errors before deploying', {exit: 4})
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

    const plan = formatPlan(changeset)
    this.log(`\n${plan}\n`)

    if (entitlementCheck && entitlementCheck.warnings.length > 0) {
      this.log(formatEntitlementWarnings(entitlementCheck.warnings))
      this.log('')
    }

    const totalChanges = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length
    if (totalChanges === 0) {
      return
    }

    if (flags['dry-run']) {
      this.log('Dry run — no changes applied.')
      this.exit(2)
    }

    if (!flags.yes) {
      const {createInterface} = await import('node:readline')
      const rl = createInterface({input: process.stdin, output: process.stdout})
      const answer = await new Promise<string>((resolve) => {
        rl.question('Apply these changes? (yes/no): ', resolve)
      })
      rl.close()
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        this.log('Cancelled.')
        return
      }
    }

    this.log('Applying changes...')
    const applyResult = await apply(changeset, refs, client)

    for (const s of applyResult.succeeded) {
      const icon = s.action === 'delete' ? '-' : s.action === 'update' ? '~' : '+'
      this.log(`  ${icon} ${s.resourceType} "${s.refKey}" — ${s.action}d`)
    }

    if (applyResult.failed.length > 0) {
      this.log('')
      for (const f of applyResult.failed) {
        this.log(`  ✗ ${f.resourceType} "${f.refKey}" — ${f.action} failed: ${f.error}`)
      }
    }

    writeState(buildState(applyResult.stateEntries))

    this.log(`\nDone: ${applyResult.succeeded.length} succeeded, ${applyResult.failed.length} failed.`)

    if (applyResult.failed.length > 0) {
      this.exit(2)
    }
  }
}
