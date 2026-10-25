import {z} from 'zod'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {formatOutput} from '../../lib/output.js'

export default class RegionsList extends DevhelmCommand {
  static description = 'List check regions (and their fixed egress IPs, for WAF allow-lists, when published)'
  static examples = ['<%= config.bin %> regions list']
  static flags = {...commonFlags}

  async run() {
    await this.parse(RegionsList)
    const rows = await apiGetSingle(this.client(), '/api/v1/regions', z.array(apiSchemas.RegionDto))
    const egress = (r: (typeof rows)[number]): string => {
      const ips = (r as {egressIps?: unknown}).egressIps
      return Array.isArray(ips) ? ips.filter((x): x is string => typeof x === 'string').join(', ') : ''
    }
    await this.finish({
      data: rows,
      human: () => this.log(formatOutput(rows, 'table', [
        {header: 'ID', get: (r: (typeof rows)[number]) => r.id},
        {header: 'NAME', get: (r: (typeof rows)[number]) => r.displayName},
        {header: 'EGRESS IPS', get: egress},
      ])),
    })
  }
}
