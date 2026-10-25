import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {table} from '../../../lib/monitors/columns.js'
import {findTrashed} from '../../../lib/monitors/trash.js'
import type {MonitorDto} from '../../../lib/monitors/resolve.js'

export default class MonitorsTrashList extends DevhelmCommand {
  static description = 'List monitors in Trash (restorable for 90 days)'
  static examples = ['<%= config.bin %> monitors trash list']
  static flags = {...commonFlags}

  async run() {
    await this.parse(MonitorsTrashList)
    const rows = await findTrashed(this.client())
    await this.finish({
      data: rows,
      human: () => this.log(table(rows, [
        {header: 'ID', get: (r: MonitorDto) => r.id},
        {header: 'NAME', get: (r: MonitorDto) => r.name},
        {header: 'TYPE', get: (r: MonitorDto) => r.type},
        {header: 'ENV', get: (r: MonitorDto) => r.environment?.slug ?? ''},
        {header: 'DELETED', get: (r: MonitorDto) => r.deletedAt ?? ''},
        {header: 'BY', get: (r: MonitorDto) => r.deletedBy?.email ?? ''},
      ])),
    })
  }
}
