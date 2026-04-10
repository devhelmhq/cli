import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

export default class NotificationPoliciesTest extends Command {
  static description = 'Test a notification policy'
  static examples = ['<%= config.bin %> notification-policies test <id>']
  static args = {id: Args.string({description: 'Policy ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(NotificationPoliciesTest)
    const client = buildClient(flags)
    await checkedFetch(client.POST('/api/v1/notification-policies/{id}/test', {
      params: {path: {id: args.id}},
      body: {},
    }))
    this.log('Test dispatch sent.')
  }
}
