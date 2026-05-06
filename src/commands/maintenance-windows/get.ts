import {Command} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import type {components} from '../../lib/api.generated.js'
import {uuidArg} from '../../lib/validators.js'

type MaintenanceWindowDto = components['schemas']['MaintenanceWindowDto']

export default class MaintenanceWindowsGet extends Command {
  static description = 'Get a maintenance window by id'
  static examples = ['<%= config.bin %> maintenance-windows get <id>']
  static args = {id: uuidArg({description: 'Maintenance window ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MaintenanceWindowsGet)
    const client = buildClient(flags)
    const value = await apiGetSingle<MaintenanceWindowDto>(
      client,
      `/api/v1/maintenance-windows/${args.id}`,
      apiSchemas.MaintenanceWindowDto as ZodType<MaintenanceWindowDto>,
    )
    display(this, value, flags.output)
  }
}
