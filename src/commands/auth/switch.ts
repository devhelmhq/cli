import {Args} from '@oclif/core'
import {listContexts, setCurrentContext} from '../../lib/auth.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {NotFoundError} from '../../lib/errors.js'

export default class AuthSwitch extends DevhelmCommand {
  static description = 'Switch the active auth context (same as `auth context use`)'
  static examples = ['<%= config.bin %> auth switch staging']
  static args = {context: Args.string({description: 'Context name to activate', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(AuthSwitch)
    if (!setCurrentContext(args.context)) {
      const names = listContexts().contexts.map((c) => c.name)
      throw new NotFoundError(`Context '${args.context}' not found${names.length ? `. Known: ${names.join(', ')}` : ''}`, {
        code: 'CONTEXT_NOT_FOUND',
        next: {command: 'devhelm auth context list', docs: null},
      })
    }
    await this.finish({data: {current: args.context}, human: () => this.log(`Switched to context '${args.context}'.`)})
  }
}
