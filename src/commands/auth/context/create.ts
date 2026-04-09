import {Command, Args, Flags} from '@oclif/core'
import {globalFlags} from '../../../lib/base-command.js'
import {saveContext} from '../../../lib/auth.js'

export default class AuthContextCreate extends Command {
  static description = 'Create a new auth context'
  static examples = ['<%= config.bin %> auth context create staging --api-url https://staging-api.devhelm.io --token sk_...']
  static args = {name: Args.string({description: 'Context name', required: true})}
  static flags = {
    ...globalFlags,
    token: Flags.string({description: 'API token', required: true}),
    'set-current': Flags.boolean({description: 'Set as current context', default: true}),
  }

  async run() {
    const {args, flags} = await this.parse(AuthContextCreate)
    const apiUrl = flags['api-url'] || 'https://api.devhelm.io'
    saveContext({name: args.name, apiUrl, token: flags.token}, flags['set-current'])
    this.log(`Context '${args.name}' created.${flags['set-current'] ? ' (active)' : ''}`)
  }
}
