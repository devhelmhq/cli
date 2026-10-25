import {Flags} from '@oclif/core'
import {apiGetSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {SECRET_REQUEST_COLUMNS, fixCommand} from '../../../lib/monitors/secret-requests.js'

export default class MonitorsSecretRequestsList extends DevhelmCommand {
  static description = "List the secret keys a code monitor's revision asks for, and whether each has a value in its environment"
  static examples = ['<%= config.bin %> monitors secret-requests list Checkout --env production']
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, env: envFlag, revision: Flags.string({description: 'Revision to inspect (default: live)'})}

  async run() {
    const {args, flags} = await this.parse(MonitorsSecretRequestsList)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const path = `/api/v1/monitors/${monitor.id}/secret-requests${flags.revision ? `?revisionId=${encodeURIComponent(flags.revision)}` : ''}`
    const dto = await apiGetSingle(client, path, apiSchemas.MonitorSecretRequestsDto)
    await this.finish({data: dto, human: () => {
      this.log(`${monitor.name} · environment ${dto.environment.slug}`)
      this.log(table(dto.requests, SECRET_REQUEST_COLUMNS))
      for (const r of dto.requests) if (r.readiness !== 'ready') this.log(`  fix: ${fixCommand(r.key, dto.environment.slug)}`)
    }})
  }
}
