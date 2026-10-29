import {Flags} from '@oclif/core'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {formatOutput} from '../../lib/output.js'

export default class RuntimesList extends DevhelmCommand {
  static description = 'List synthetics runtimes (Node and Playwright versions, lifecycle)'
  static examples = ['<%= config.bin %> runtimes list', '<%= config.bin %> runtimes list --deprecations']
  static flags = {
    ...commonFlags,
    deprecations: Flags.boolean({description: 'Only runtimes that are deprecated, retired or have an end-of-life date', default: false}),
  }

  async run() {
    const {flags} = await this.parse(RuntimesList)
    const page = await apiGetPage(this.client(), '/api/v1/synthetics/runtime-profiles', apiSchemas.RuntimeProfileDto)
    const rows = flags.deprecations
      ? page.data.filter((r) => r.status === 'deprecated' || r.status === 'retired' || Boolean(r.eolAt) || Boolean(r.deprecatedAt))
      : page.data
    await this.finish({
      data: rows,
      human: () => this.log(formatOutput(rows, 'table', [
        {header: 'ID', get: (r: (typeof rows)[number]) => r.id},
        {header: 'STATUS', get: (r: (typeof rows)[number]) => r.status},
        {header: 'DEFAULT', get: (r: (typeof rows)[number]) => r.platformDefault ? 'yes' : ''},
        {header: 'NODE', get: (r: (typeof rows)[number]) => r.nodeVersion},
        {header: 'PLAYWRIGHT', get: (r: (typeof rows)[number]) => r.playwrightVersion},
        {header: 'DEPRECATED', get: (r: (typeof rows)[number]) => r.deprecatedAt ?? ''},
        {header: 'EOL', get: (r: (typeof rows)[number]) => r.eolAt ?? ''},
      ])),
    })
  }
}
