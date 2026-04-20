import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiGet} from '../../../lib/api-client.js'
import type {components} from '../../../lib/api.generated.js'
import {uuidArg} from '../../../lib/validators.js'

type MonitorVersionDto = components['schemas']['MonitorVersionDto']

export default class MonitorsVersionsGet extends Command {
  static description = 'Get a specific version snapshot for a monitor'
  static examples = [
    '<%= config.bin %> monitors versions get 42 3',
    '<%= config.bin %> monitors versions get 42 3 -o json',
  ]

  static args = {
    id: uuidArg({description: 'Monitor ID', required: true}),
    version: Args.integer({description: 'Version number', required: true}),
  }

  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsVersionsGet)
    const client = buildClient(flags)
    const resp = await apiGet<{data?: MonitorVersionDto}>(
      client,
      `/api/v1/monitors/${args.id}/versions/${args.version}`,
    )
    display(this, resp.data ?? resp, flags.output)
  }
}
