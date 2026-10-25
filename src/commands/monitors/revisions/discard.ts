import {Args} from '@oclif/core'
import {apiDelete} from '../../../lib/api-client.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

export default class MonitorsRevisionsDiscard extends DevhelmCommand {
  static description = 'Discard a draft revision (a live or once-live revision cannot be discarded)'
  static examples = ['<%= config.bin %> monitors revisions discard Checkout <revision-id>']
  static args = {monitor: monitorArg, revision: Args.string({description: 'Revision id', required: true})}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsDiscard)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    await apiDelete(client, `/api/v1/monitors/${monitor.id}/revisions/${args.revision}`)
    await this.finish({data: {monitorId: monitor.id, revisionId: args.revision, discarded: true}, human: () => this.log(`Discarded draft ${args.revision}.`)})
  }
}
