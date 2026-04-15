import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'

export default class StatusPagesIncidentsCreate extends Command {
  static description = 'Create an incident on a status page'
  static examples = ['<%= config.bin %> status-pages incidents create <page-id> --title "Outage" --impact MAJOR']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    title: Flags.string({description: 'Incident title', required: true}),
    impact: Flags.string({description: 'Incident impact', required: true, options: ['NONE', 'MINOR', 'MAJOR', 'CRITICAL']}),
    body: Flags.string({description: 'Incident body/message'}),
    status: Flags.string({description: 'Incident status', options: ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED']}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsCreate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {title: flags.title, impact: flags.impact}
    if (flags.body) body.body = flags.body
    if (flags.status) body.status = flags.status
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/incidents`, body)
    display(this, resp.data ?? resp, flags.output)
  }
}
