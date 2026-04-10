import {Command} from '@oclif/core'
import {globalFlags, display} from '../../../lib/base-command.js'
import {listContexts} from '../../../lib/auth.js'

export default class AuthContextList extends Command {
  static description = 'List all auth contexts'
  static examples = ['<%= config.bin %> auth context list']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(AuthContextList)
    const {current, contexts} = listContexts()
    if (contexts.length === 0) { this.log('No contexts found. Run `devhelm auth login` to create one.'); return }
    const data = contexts.map((ctx) => ({
      current: ctx.name === current ? '*' : '',
      name: ctx.name,
      'api-url': ctx.apiUrl,
      token: ctx.token.slice(0, 8) + '...' + ctx.token.slice(-4),
    }))
    display(this, data, flags.output, [
      {header: '', get: (r: Record<string, string>) => r.current ?? ''},
      {header: 'NAME', get: (r: Record<string, string>) => r.name ?? ''},
      {header: 'API URL', get: (r: Record<string, string>) => r['api-url'] ?? ''},
      {header: 'TOKEN', get: (r: Record<string, string>) => r.token ?? ''},
    ])
  }
}
