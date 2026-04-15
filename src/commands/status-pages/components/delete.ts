import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiDelete} from '../../../lib/api-client.js'

export default class StatusPagesComponentsDelete extends Command {
  static description = 'Remove a component from a status page'
  static examples = ['<%= config.bin %> status-pages components delete <page-id> <component-id>']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'component-id': Args.string({description: 'Component ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsDelete)
    const client = buildClient(flags)
    await apiDelete(client, `/api/v1/status-pages/${args.id}/components/${args['component-id']}`)
    this.log(`Component '${args['component-id']}' deleted.`)
  }
}
