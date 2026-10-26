import {Flags} from '@oclif/core'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag} from '../../lib/cli/flags.js'
import {MONITOR_LIST_COLUMNS, table} from '../../lib/monitors/columns.js'
import {resolveEnvironment, type MonitorDto} from '../../lib/monitors/resolve.js'
import {MONITOR_TYPES} from '../../lib/spec-facts.generated.js'

const OWNERS = ['dashboard', 'git', 'terraform', 'api', 'mcp']

export default class MonitorsList extends DevhelmCommand {
  static legacyOutput = true
  static description = 'List monitors, optionally filtered by name, environment, type, tag, owner or health'
  static examples = [
    '<%= config.bin %> monitors list',
    '<%= config.bin %> monitors list --env production --type BROWSER',
    '<%= config.bin %> monitors list --owner git --health down -o json',
  ]

  static flags = {
    ...commonFlags,
    name: Flags.string({description: 'Exact monitor name'}),
    env: envFlag,
    type: Flags.string({description: 'Monitor type', options: [...MONITOR_TYPES]}),
    tag: Flags.string({description: 'Tag name'}),
    owner: Flags.string({description: 'Owning tool', options: OWNERS}),
    health: Flags.string({description: 'Display health, e.g. healthy, down, degraded, flaky, blocked, paused'}),
    'page-size': Flags.integer({description: 'Number of items per API request (1–200)', default: 200}),
  }

  async run() {
    const {flags} = await this.parse(MonitorsList)
    const client = this.client()
    const query: Record<string, string | number> = {size: flags['page-size']}
    if (flags.name) {
      query.name = flags.name
      query.search = flags.name
    }
    if (flags.env) query.environmentId = (await resolveEnvironment(client, flags.env)).id
    if (flags.type) query.type = flags.type
    if (flags.tag) query.tag = flags.tag
    if (flags.owner) query.managedBy = flags.owner.toUpperCase()
    if (flags.health) query.displayHealth = flags.health
    const items: MonitorDto[] = []
    for (let page = 0; ; page++) {
      const resp = await apiGetPage(client, '/api/v1/monitors', apiSchemas.MonitorDto, {query: {...query, page}})
      items.push(...resp.data)
      if (!resp.hasNext) break
    }
    // `--name` is an exact, case-sensitive match even where the server only searches.
    const rows = flags.name ? items.filter((m) => m.name === flags.name) : items
    await this.finish({data: rows, human: () => this.log(table(rows, MONITOR_LIST_COLUMNS))})
  }
}
