import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

export default class WebhooksTest extends Command {
  static description = 'Send a test event to a webhook'
  static examples = ['<%= config.bin %> webhooks test <id>']
  static args = {id: Args.string({description: 'Webhook ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(WebhooksTest)
    const client = buildClient(flags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.POST(`/api/v1/webhooks/${args.id}/test` as any, {} as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (resp as any)?.data ?? resp
    this.log(result.success ? 'Test event delivered.' : 'Test delivery failed.')
  }
}
