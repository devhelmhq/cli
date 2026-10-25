import {fetchPaginatedValidated} from '../../lib/typed-api.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {formatOutput} from '../../lib/output.js'

export default class WorkspacesList extends DevhelmCommand {
  static description = 'List workspaces in the organization (use the id with --workspace)'
  static examples = ['<%= config.bin %> workspaces list']
  static flags = {...commonFlags}

  async run() {
    await this.parse(WorkspacesList)
    const rows = await fetchPaginatedValidated(this.client(), '/api/v1/workspaces', apiSchemas.WorkspaceDto, 100)
    await this.finish({
      data: rows,
      human: () => this.log(formatOutput(rows, 'table', [
        {header: 'ID', get: (r: (typeof rows)[number]) => String(r.id)},
        {header: 'NAME', get: (r: (typeof rows)[number]) => r.name},
        {header: 'CREATED', get: (r: (typeof rows)[number]) => r.createdAt},
      ])),
    })
  }
}
