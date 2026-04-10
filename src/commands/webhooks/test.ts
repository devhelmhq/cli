import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {typedPost} from '../../lib/typed-api.js'

export default class WebhooksTest extends Command {
  static description = 'Send a test event to a webhook'
  static examples = ['<%= config.bin %> webhooks test <id>']
  static args = {id: Args.string({description: 'Webhook ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(WebhooksTest)
    const client = buildClient(flags)
    const resp = await typedPost<{data?: {success?: boolean}}>(client, `/api/v1/webhooks/${args.id}/test`)
    this.log(resp.data?.success ? 'Test event delivered.' : 'Test delivery failed.')
  }
}
