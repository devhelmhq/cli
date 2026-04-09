import {Command, Flags} from '@oclif/core'
import {ApiClient} from '../../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../../lib/auth.js'
import {AuthError} from '../../lib/errors.js'

export default class MonitorsList extends Command {
  static override description = 'List all monitors'

  static override examples = [
    '<%= config.bin %> monitors list',
    '<%= config.bin %> monitors list --json',
  ]

  static override flags = {
    json: Flags.boolean({description: 'Output as JSON', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MonitorsList)

    const token = resolveToken()
    if (!token) throw new AuthError()

    const client = new ApiClient({baseUrl: resolveApiUrl(), token})
    const monitors = await client.get<{content: Array<{id: number; name: string; type: string; status: string}>}>(
      '/platform/monitors?size=50',
    )

    if (flags.json) {
      this.log(JSON.stringify(monitors.content, null, 2))
      return
    }

    if (monitors.content.length === 0) {
      this.log('No monitors found.')
      return
    }

    for (const m of monitors.content) {
      this.log(`  ${m.id}\t${m.status}\t${m.type}\t${m.name}`)
    }
  }
}
