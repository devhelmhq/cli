import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag} from '../../lib/cli/flags.js'
import {resolveEnvironment} from '../../lib/monitors/resolve.js'
import {formatOutput} from '../../lib/output.js'

export default class SecretsList extends DevhelmCommand {
  static legacyOutput = true
  static description = 'List secrets (keys only; values are never shown). --env adds whether each has a value there'
  static examples = ['<%= config.bin %> secrets list', '<%= config.bin %> secrets list --env production']
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {flags} = await this.parse(SecretsList)
    const client = this.client()
    const query: Record<string, string | number> = {page: 0, size: 200}
    if (flags.env) query.environmentId = (await resolveEnvironment(client, flags.env)).id
    const rows = (await apiGetPage(client, '/api/v1/secrets', apiSchemas.SecretDto, {query})).data
    await this.finish({
      data: rows,
      human: () => this.log(formatOutput(rows, 'table', [
        {header: 'KEY', get: (r: (typeof rows)[number]) => r.key},
        ...(flags.env ? [{header: `VALUE IN ${flags.env.toUpperCase()}`, get: (r: (typeof rows)[number]) => (r.valueStamp ? 'set' : '—')}] : []),
        {header: 'USED BY', get: (r: (typeof rows)[number]) => String(r.usedByMonitors?.length ?? '')},
        {header: 'CREATED', get: (r: (typeof rows)[number]) => r.createdAt},
        {header: 'UPDATED', get: (r: (typeof rows)[number]) => r.updatedAt},
      ])),
    })
  }
}
