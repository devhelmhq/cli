import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {EVENT_COLUMNS, postWait, show, unwrapKey, waitOrExplain} from '../../lib/inbound.js'
import {uuidArg} from '../../lib/validators.js'

export default class InboxesWait extends Command {
  static description = 'Wait for the next request sent to a capture URL'
  static args = {id: uuidArg({description: 'Inbox ID', required: true})}
  static flags = {
    ...globalFlags,
    'timeout-ms': Flags.integer({description: 'How long to wait, in milliseconds', default: 30000}),
    'received-after': Flags.string({description: 'Ignore events received before this timestamp'}),
    method: Flags.string({description: 'HTTP method to match'}),
    'path-prefix': Flags.string({description: 'Captured path must start with this prefix'}),
  }

  async run() {
    const {args, flags} = await this.parse(InboxesWait)
    const http: Record<string, string> = {}
    if (flags.method) http.method = flags.method
    if (flags['path-prefix']) http.pathPrefix = flags['path-prefix']
    const body: Record<string, unknown> = {
      timeoutMs: flags['timeout-ms'],
      receivedAfter: flags['received-after'] ?? new Date().toISOString(),
    }
    if (Object.keys(http).length > 0) body.http = http
    const raw = await waitOrExplain(this, `inbox ${args.id}`, () =>
      postWait(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}/wait`, body, flags['timeout-ms']),
    )
    const event = unwrapKey(raw, 'event')
    if (flags.output === 'table') {
      show(this, [event], flags.output, EVENT_COLUMNS)
      return
    }
    show(this, event, flags.output)
  }
}
