import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {SingleResponse} from '../../lib/api-client.js'

export default class AlertChannelsTest extends Command {
  static description = 'Send a test notification to an alert channel'
  static examples = ['<%= config.bin %> alert-channels test <id>']
  static args = {id: Args.string({description: 'Alert channel ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(AlertChannelsTest)
    const client = buildClient(flags)
    const resp = await client.post<SingleResponse<{success: boolean}>>(`/api/v1/alert-channels/${args.id}/test`)
    this.log(resp.content.success ? 'Test notification sent successfully.' : 'Test notification failed.')
  }
}
