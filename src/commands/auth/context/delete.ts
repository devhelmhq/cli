import {Command, Args} from '@oclif/core'
import {globalFlags} from '../../../lib/base-command.js'
import {removeContext} from '../../../lib/auth.js'

export default class AuthContextDelete extends Command {
  static description = 'Delete an auth context'
  static examples = ['<%= config.bin %> auth context delete staging']
  static args = {name: Args.string({description: 'Context name to delete', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args} = await this.parse(AuthContextDelete)
    const ok = removeContext(args.name)
    if (!ok) { this.error(`Context '${args.name}' not found.`, {exit: 1}) }
    this.log(`Context '${args.name}' deleted.`)
  }
}
