import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {postRecord} from '../../lib/inbound.js'

export default class InboxesCreate extends Command {
  static description = 'Create an inbound HTTP capture URL'
  static examples = ['<%= config.bin %> inboxes create --name stripe']
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Inbox name', required: true}),
    status: Flags.string({description: 'active or disabled', options: ['active', 'disabled']}),
    cors: Flags.boolean({description: 'Allow browser callers from other origins', allowNo: true}),
    'retention-days': Flags.integer({description: 'Days to keep events'}),
    'max-events': Flags.integer({description: 'Max stored events'}),
    'response-status': Flags.integer({description: 'Mock reply status'}),
    'response-body': Flags.string({description: 'Mock reply body'}),
    'response-content-type': Flags.string({description: 'Mock reply content type'}),
    'response-delay-ms': Flags.integer({description: 'Delay before the mock reply'}),
  }

  async run() {
    const {flags} = await this.parse(InboxesCreate)
    const client = buildClient(flags)
    const httpResponse: Record<string, unknown> = {}
    if (flags['response-status'] !== undefined) httpResponse.status = flags['response-status']
    if (flags['response-body'] !== undefined) httpResponse.body = flags['response-body']
    if (flags['response-content-type'] !== undefined) httpResponse.contentType = flags['response-content-type']
    if (flags['response-delay-ms'] !== undefined) httpResponse.delayMs = flags['response-delay-ms']
    const body: Record<string, unknown> = {name: flags.name}
    if (flags.status) body.status = flags.status
    if (flags.cors !== undefined) body.cors = flags.cors
    if (flags['retention-days'] !== undefined) body.retentionDays = flags['retention-days']
    if (flags['max-events'] !== undefined) body.maxEvents = flags['max-events']
    if (Object.keys(httpResponse).length > 0) body.httpResponse = httpResponse
    const inbox = await postRecord(client, '/api/v1/webhook/inboxes', body)
    if (flags.output === 'table') {
      this.log(String(inbox.httpUrl ?? ''))
      return
    }
    this.log(flags.output === 'yaml' ? (await import('yaml')).stringify(inbox).trimEnd() : JSON.stringify(inbox, null, 2))
  }
}
