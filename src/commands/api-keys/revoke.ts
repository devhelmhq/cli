import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

export default class ApiKeysRevoke extends Command {
  static description = 'Revoke an API key'
  static examples = ['<%= config.bin %> api-keys revoke <id>']
  static args = {id: Args.string({description: 'API key ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(ApiKeysRevoke)
    const client = buildClient(flags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await checkedFetch(client.POST(`/api/v1/api-keys/${args.id}/revoke` as any, {} as any))
    this.log(`API key '${args.id}' revoked.`)
  }
}
