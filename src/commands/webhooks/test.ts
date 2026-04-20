import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'
import {uuidArg} from '../../lib/validators.js'

export default class WebhooksTest extends Command {
  static description = 'Send a test event to a webhook'
  static examples = ['<%= config.bin %> webhooks test <id>']
  static args = {id: uuidArg({description: 'Webhook ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(WebhooksTest)
    const client = buildClient(flags)
    const resp = (await checkedFetch(
      client.POST('/api/v1/webhooks/{id}/test', {params: {path: {id: args.id}}}),
    )) as {data?: {success?: boolean}}
    this.log(resp.data?.success ? 'Test event delivered.' : 'Test delivery failed.')
  }
}
