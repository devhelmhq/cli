import {Command} from '@oclif/core'
import {globalFlags} from '../../lib/base-command.js'
import {getCurrentContext, removeContext} from '../../lib/auth.js'

export default class AuthLogout extends Command {
  static description = 'Remove the current auth context'
  static examples = ['<%= config.bin %> auth logout']
  static flags = {...globalFlags}

  async run() {
    await this.parse(AuthLogout)
    const ctx = getCurrentContext()
    if (!ctx) { this.log('No active context. Already logged out.'); return }
    removeContext(ctx.name)
    this.log(`Removed context '${ctx.name}'. Logged out.`)
  }
}
