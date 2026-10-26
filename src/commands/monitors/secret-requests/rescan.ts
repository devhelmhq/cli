import {apiPostSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {SECRET_REQUEST_COLUMNS} from '../../../lib/monitors/secret-requests.js'

export default class MonitorsSecretRequestsRescan extends DevhelmCommand {
  static description = "Re-scan the live revision for the secret keys it reads"
  static examples = ['<%= config.bin %> monitors secret-requests rescan Checkout --env production']
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsSecretRequestsRescan)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const dto = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/secret-requests/rescan`, apiSchemas.MonitorSecretRequestsDto)
    await this.finish({data: dto, human: () => this.log(table(dto.requests, SECRET_REQUEST_COLUMNS))})
  }
}
