import {Args, Flags} from '@oclif/core'
import {apiPostSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {parse} from '../../../lib/response-validation.js'

export default class MonitorsRevisionsPurge extends DevhelmCommand {
  static description = "Purge a revision's code bytes (e.g. after a leaked secret). The revision record stays"
  static examples = ['<%= config.bin %> monitors revisions purge Checkout <revision-id> --reason "token committed by mistake"']
  static args = {monitor: monitorArg, revision: Args.string({description: 'Revision id', required: true})}
  static flags = {...commonFlags, env: envFlag, reason: Flags.string({description: 'Why the bytes are purged (audited)', required: true})}

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsPurge)
    const client = this.client()
    await resolveMonitor(client, args.monitor, {env: flags.env})
    const body = parse(apiSchemas.EvidencePurgeRequest, {reason: flags.reason}, 'purge body invalid')
    const rv = await apiPostSingle(client, `/api/v1/revisions/${args.revision}/purge`, apiSchemas.RevisionDto, body)
    await this.finish({data: rv, human: () => this.log(`Purged revision #${rv.number} (${rv.id}).`)})
  }
}
