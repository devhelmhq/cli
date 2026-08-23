import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenancePostUpdate extends Command {
  static description = 'Post a timeline update on a status page maintenance window'
  static examples = [
    '<%= config.bin %> status-pages maintenance post-update <page-id> <window-id> --body "Halfway through" --status MONITORING',
  ]
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    body: Flags.string({description: 'Update message', required: true}),
    status: Flags.string({description: 'New status', required: true, options: [...SP_INCIDENT_STATUSES]}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenancePostUpdate)
    const client = buildClient(flags)
    const resp = await apiPost(
      client,
      `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}/updates`,
      {body: flags.body, status: flags.status},
    )
    display(this, unwrapData(resp), flags.output)
  }
}
