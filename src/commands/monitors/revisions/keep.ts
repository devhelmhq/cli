import {Args} from '@oclif/core'
import {apiPostSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

export default class MonitorsRevisionsKeep extends DevhelmCommand {
  static description = 'Keep a draft past its 14-day expiry'
  static examples = ['<%= config.bin %> monitors revisions keep Checkout <revision-id>']
  static args = {monitor: monitorArg, revision: Args.string({description: 'Revision id', required: true})}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsKeep)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const rv = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/revisions/${args.revision}/keep`, apiSchemas.RevisionDto)
    await this.finish({data: rv, human: () => this.log(`Kept draft #${rv.number}${rv.expiresAt ? ` (expires ${rv.expiresAt})` : ''}.`)})
  }
}
