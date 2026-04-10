import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {typedPost} from '../../lib/typed-api.js'

export default class NotificationPoliciesTest extends Command {
  static description = 'Test a notification policy'
  static examples = ['<%= config.bin %> notification-policies test <id>']
  static args = {id: Args.string({description: 'Policy ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(NotificationPoliciesTest)
    const client = buildClient(flags)
    await typedPost(client, `/api/v1/notification-policies/${args.id}/test`)
    this.log('Test dispatch sent.')
  }
}
