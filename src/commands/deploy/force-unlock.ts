import {Command, Flags} from '@oclif/core'
import {createApiClient, apiDelete} from '../../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../../lib/auth.js'
import {DevhelmApiError, EXIT_CODES} from '../../lib/errors.js'
import {urlFlag} from '../../lib/validators.js'

export default class DeployForceUnlock extends Command {
  static description = 'Force-release a stuck deploy lock on the current workspace'

  static examples = [
    '<%= config.bin %> deploy force-unlock',
    '<%= config.bin %> deploy force-unlock --yes',
  ]

  static flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt',
      default: false,
    }),
    'api-url': urlFlag({description: 'Override API base URL'}),
    'api-token': Flags.string({description: 'Override API token'}),
    verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  }

  async run() {
    const {flags} = await this.parse(DeployForceUnlock)

    if (!flags.yes) {
      const {createInterface} = await import('node:readline')
      const rl = createInterface({input: process.stdin, output: process.stdout})
      const answer = await new Promise<string>((resolve) => {
        rl.question('Force-unlock removes any active deploy lock. This is dangerous if another deploy is in progress.\nContinue? (yes/no): ', resolve)
      })
      rl.close()
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        this.log('Cancelled.')
        return
      }
    }

    const token = flags['api-token'] ?? resolveToken()
    if (!token) {
      this.error(
        'No API token configured. Run "devhelm auth login" or set DEVHELM_API_TOKEN.',
        {exit: EXIT_CODES.VALIDATION},
      )
    }

    const client = createApiClient({
      baseUrl: flags['api-url'] ?? resolveApiUrl(),
      token,
      verbose: flags.verbose,
    })

    try {
      await apiDelete(client, '/api/v1/deploy/lock/force')
      this.log('Deploy lock released.')
    } catch (err) {
      // Branch on the typed error rather than substring-matching the message:
      // the canonical DevhelmApiError carries a real HTTP status, so 404
      // ("no lock to release") is unambiguous and we exit successfully.
      if (err instanceof DevhelmApiError && err.status === 404) {
        this.log('No active deploy lock found.')
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      this.error(`Failed to release lock: ${msg}`, {exit: EXIT_CODES.API})
    }
  }
}
