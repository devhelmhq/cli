import {Command} from '@oclif/core'
import type {z} from 'zod'
import {apiGetPage} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

type CategoryDto = components['schemas']['CategoryDto']

const COLUMNS: ColumnDef<CategoryDto>[] = [
  {header: 'CATEGORY', get: (r) => r.category ?? ''},
  {header: 'SERVICES', get: (r) => (r.serviceCount == null ? '' : String(r.serviceCount))},
]

export default class ServicesCategories extends Command {
  static description = 'List service catalog categories with service counts'
  static examples = ['<%= config.bin %> services categories']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(ServicesCategories)
    const client = buildClient(flags)
    const result = await apiGetPage(
      client,
      '/api/v1/categories',
      apiSchemas.CategoryDto as z.ZodType<CategoryDto>,
    )
    display(this, result.data, flags.output, COLUMNS as ColumnDef[])
  }
}
