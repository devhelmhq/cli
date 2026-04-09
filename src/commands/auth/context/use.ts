import {Command, Args} from '@oclif/core'
import {globalFlags} from '../../../lib/base-command.js'
import {setCurrentContext} from '../../../lib/auth.js'

export default class AuthContextUse extends Command {
  static description = 'Switch to a different auth context'
  static examples = ['<%= config.bin %> auth context use staging']
  static args = {name: Args.string({description: 'Context name to activate', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args} = await this.parse(AuthContextUse)
    const ok = setCurrentContext(args.name)
    if (!ok) { this.error(`Context '${args.name}' not found.`, {exit: 1}) }
    this.log(`Switched to context '${args.name}'.`)
  }
}
