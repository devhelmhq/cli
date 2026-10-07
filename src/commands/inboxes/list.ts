import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {INBOX_COLUMNS, listTable, show} from '../../lib/inbound.js'

export default class InboxesList extends Command {
  static description = 'List inbound HTTP capture URLs'
  static flags = {
    ...globalFlags,
    search: Flags.string({description: 'Match the inbox name'}),
  }

  async run() {
    const {flags} = await this.parse(InboxesList)
    const rows = await listTable(
      buildClient(flags),
      '/api/v1/webhook/inboxes',
      flags.search ? {query: {search: flags.search}} : undefined,
    )
    show(this, rows, flags.output, INBOX_COLUMNS)
  }
}
