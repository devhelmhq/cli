import {Command, Args, Flags} from '@oclif/core'
import {globalFlags} from '../../../lib/base-command.js'
import {createApiClient, checkedFetch} from '../../../lib/api-client.js'
import {saveContext} from '../../../lib/auth.js'

export default class AuthContextCreate extends Command {
  static description = 'Create a new auth context (validates token before saving)'
  static examples = ['<%= config.bin %> auth context create staging --api-url https://staging-api.devhelm.io --token dh_live_...']
  static args = {name: Args.string({description: 'Context name', required: true})}
  static flags = {
    ...globalFlags,
    token: Flags.string({description: 'API token', required: true}),
    'set-current': Flags.boolean({description: 'Set as current context', default: true}),
    'skip-validation': Flags.boolean({description: 'Save without validating the token', default: false}),
  }

  async run() {
    const {args, flags} = await this.parse(AuthContextCreate)
    const apiUrl = flags['api-url'] || 'https://api.devhelm.io'

    if (!flags['skip-validation']) {
      const client = createApiClient({baseUrl: apiUrl, token: flags.token})
      try {
        await checkedFetch(client.GET('/api/v1/auth/me'))
      } catch {
        try {
          await checkedFetch(client.GET('/api/v1/dashboard/overview'))
        } catch {
          this.error('Token validation failed. Use --skip-validation to save anyway.', {exit: 2})
        }
      }
    }

    saveContext({name: args.name, apiUrl, token: flags.token}, flags['set-current'])
    this.log(`Context '${args.name}' created.${flags['set-current'] ? ' (active)' : ''}`)
  }
}
