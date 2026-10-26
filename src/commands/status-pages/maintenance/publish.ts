import {formatOutput} from '../../../lib/output.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {publicWriteFlags} from '../../../lib/cli/public-write.js'
import {runStatusPageWrite} from '../../../lib/cli/status-page-writes.js'
import {parse} from '../../../lib/response-validation.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenancePublish extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Publish a draft maintenance window (gated like create)'
  static examples = ['<%= config.bin %> status-pages maintenance publish <page-id> <window-id> --no-notify-subscribers']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {...commonFlags, ...publicWriteFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenancePublish)
    const data = await runStatusPageWrite(this.client(), {
      id: this.id, argv: this.argv, action: 'status_page_maintenance.publish', page: args.id, target: args['window-id'],
      path: `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}/publish`, text: {},
      notifySubscribers: flags['notify-subscribers'], confirm: flags.confirm,
      build: (notifySubscribers) => parse(apiSchemas.PublishStatusPageIncidentRequest, {notifySubscribers}, 'Invalid publish request'),
    })
    await this.finish({data, human: () => this.log(formatOutput(data, 'table'))})
  }
}
