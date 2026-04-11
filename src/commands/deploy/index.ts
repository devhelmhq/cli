import {hostname} from 'node:os'
import {Command, Flags} from '@oclif/core'
import {createApiClient, apiPost, apiDelete} from '../../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../../lib/auth.js'
import {EXIT_CODES} from '../../lib/errors.js'
import {loadConfig, validate, fetchAllRefs, diff, formatPlan, changesetToJson, apply, writeState, buildState} from '../../lib/yaml/index.js'
import {checkEntitlements, formatEntitlementWarnings} from '../../lib/yaml/entitlements.js'

const DEFAULT_LOCK_TTL = 30

export default class Deploy extends Command {
  static description = 'Deploy devhelm.yml configuration to the DevHelm API'

  static examples = [
    '<%= config.bin %> deploy',
    '<%= config.bin %> deploy --yes',
    '<%= config.bin %> deploy -f monitors.yml',
    '<%= config.bin %> deploy --prune --yes',
    '<%= config.bin %> deploy --prune-all --yes',
    '<%= config.bin %> deploy --dry-run',
    '<%= config.bin %> deploy --dry-run --detailed-exitcode',
    '<%= config.bin %> deploy -o json --yes',
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
    'prune-all': Flags.boolean({
      description: 'Delete ALL resources not in config, including those not managed by the CLI (use with caution)',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would change without applying (same as "devhelm plan")',
      default: false,
    }),
    'detailed-exitcode': Flags.boolean({
      description: 'Return exit code 10 if dry-run has changes (for CI)',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format (text or json)',
      options: ['text', 'json'],
      default: 'text',
    }),
    'force-unlock': Flags.boolean({
      description: 'Force-break an existing deploy lock before acquiring',
      default: false,
    }),
    'no-lock': Flags.boolean({
      description: 'Skip deploy locking (not recommended for team use)',
      default: false,
    }),
    'lock-timeout': Flags.integer({
      description: 'Seconds to wait for a conflicting lock to release (0 = fail immediately)',
      default: 0,
    }),
    'api-url': Flags.string({description: 'Override API base URL'}),
    'api-token': Flags.string({description: 'Override API token'}),
    verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Deploy)
    const isJson = flags.output === 'json'

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

    if (!isJson) this.log('Fetching current state from API...')
    const refs = await fetchAllRefs(client)

    const changeset = diff(config, refs, {prune: flags.prune || flags['prune-all'], pruneAll: flags['prune-all']})

    const entitlementCheck = await checkEntitlements(client, changeset)

    if (isJson && flags['dry-run']) {
      this.log(JSON.stringify(changesetToJson(changeset), null, 2))
      const totalChanges = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length
      if (totalChanges > 0 && flags['detailed-exitcode']) {
        this.exit(EXIT_CODES.CHANGES_PENDING)
      }
      return
    }

    if (!isJson) {
      if (entitlementCheck) {
        this.log(entitlementCheck.header)
      }

      const plan = formatPlan(changeset)
      this.log(`\n${plan}\n`)

      if (entitlementCheck && entitlementCheck.warnings.length > 0) {
        this.log(formatEntitlementWarnings(entitlementCheck.warnings))
        this.log('')
      }
    }

    const totalChanges = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length
    if (totalChanges === 0) {
      if (isJson) this.log(JSON.stringify({plan: changesetToJson(changeset), result: {succeeded: [], failed: []}}, null, 2))
      return
    }

    if (flags['dry-run']) {
      if (!isJson) this.log('Dry run — no changes applied.')
      if (flags['detailed-exitcode']) {
        this.exit(EXIT_CODES.CHANGES_PENDING)
      }
      return
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

    let lockId: string | undefined
    if (!flags['no-lock']) {
      lockId = await this.acquireLock(client, flags['force-unlock'], flags['lock-timeout'])
    }

    try {
      if (!isJson) this.log('Applying changes...')
      const applyResult = await apply(changeset, refs, client)

      if (isJson) {
        this.log(JSON.stringify({
          plan: changesetToJson(changeset),
          result: {succeeded: applyResult.succeeded, failed: applyResult.failed},
        }, null, 2))
      } else {
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

        this.log(`\nDone: ${applyResult.succeeded.length} succeeded, ${applyResult.failed.length} failed.`)
      }

      writeState(buildState(applyResult.stateEntries))

      if (applyResult.failed.length > 0) {
        this.exit(EXIT_CODES.PARTIAL_FAILURE)
      }
    } finally {
      if (lockId) {
        await this.releaseLock(client, lockId)
      }
    }
  }

  private async acquireLock(
    client: ReturnType<typeof createApiClient>,
    forceUnlock: boolean,
    lockTimeout: number,
  ): Promise<string | undefined> {
    if (forceUnlock) {
      try {
        await apiDelete(client, '/api/v1/deploy/lock/force')
      } catch {
        // Force-unlock is best-effort; the lock may not exist
      }
    }

    const deadline = Date.now() + lockTimeout * 1000
    let lastError: string | undefined

    while (true) {
      try {
        const resp = await apiPost<{data?: {id?: string}}>(
          client, '/api/v1/deploy/lock',
          {lockedBy: `${process.env.USER ?? 'cli'}@${hostname()}`, ttlMinutes: DEFAULT_LOCK_TTL},
        )
        const lockId = resp.data?.id
        if (!lockId) {
          this.warn('Deploy lock acquired but no lock ID returned. Proceeding without lock protection.')
        }
        return lockId
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isConflict = msg.includes('409') || msg.includes('Conflict') || msg.includes('lock held')

        if (isConflict && Date.now() < deadline) {
          lastError = msg
          const remaining = Math.ceil((deadline - Date.now()) / 1000)
          this.log(`Lock held by another session. Retrying... (${remaining}s remaining)`)
          await new Promise((r) => setTimeout(r, 5000))
          continue
        }

        if (isConflict) {
          this.warn(`Deploy lock conflict: ${lastError ?? msg}`)
          this.warn('Use --force-unlock to break the existing lock, --lock-timeout to wait, or --no-lock to skip.')
          this.exit(EXIT_CODES.API)
        }
        this.warn(`Failed to acquire deploy lock: ${msg}`)
        this.warn('Use --no-lock to skip locking if the lock service is unavailable.')
        this.exit(EXIT_CODES.API)
      }
    }
  }

  private async releaseLock(client: ReturnType<typeof createApiClient>, lockId: string): Promise<void> {
    try {
      await apiDelete(client, `/api/v1/deploy/lock/${lockId}`)
    } catch { /* best-effort release */ }
  }
}
