import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPut, unwrapData} from '../../../lib/api-client.js'
import {SP_INCIDENT_IMPACTS, SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsUpdate extends Command {
  static description = 'Update a status page incident'
  static examples = ['<%= config.bin %> status-pages incidents update <page-id> <incident-id> --status RESOLVED']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'incident-id': uuidArg({description: 'Incident ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    title: Flags.string({description: 'Incident title'}),
    impact: Flags.string({description: 'Incident impact', options: [...SP_INCIDENT_IMPACTS]}),
    status: Flags.string({description: 'Incident status', options: [...SP_INCIDENT_STATUSES]}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsUpdate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {}
    if (flags.title) body.title = flags.title
    if (flags.impact) body.impact = flags.impact
    if (flags.status) body.status = flags.status
    const resp = await apiPut(client, `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}`, body)
    display(this, unwrapData(resp), flags.output)
  }
}
