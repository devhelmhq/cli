import {Command} from '@oclif/core'
import {globalFlags, display} from '../../../lib/base-command.js'
import {getCurrentContext} from '../../../lib/auth.js'

export default class AuthContext extends Command {
  static description = 'Show the current auth context'
  static examples = ['<%= config.bin %> auth context']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(AuthContext)
    const ctx = getCurrentContext()
    if (!ctx) { this.log('No active context. Run `devhelm auth login` to create one.'); return }
    display(this, {name: ctx.name, 'api-url': ctx.apiUrl, token: ctx.token.slice(0, 8) + '...' + ctx.token.slice(-4)}, flags.output)
  }
}
