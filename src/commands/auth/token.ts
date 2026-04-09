import {Command} from '@oclif/core'
import {globalFlags} from '../../lib/base-command.js'
import {resolveToken} from '../../lib/auth.js'

export default class AuthToken extends Command {
  static description = 'Print the current API token'
  static examples = ['<%= config.bin %> auth token']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(AuthToken)
    const token = flags['api-token'] || resolveToken()
    if (!token) { this.error('No token found. Run `devhelm auth login` first.', {exit: 2}) }
    this.log(token)
  }
}
