import {Args, Flags} from '@oclif/core'
import {apiGet} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {formatOutput} from '../../lib/output.js'
import {parse} from '../../lib/response-validation.js'

export default class RunsNetwork extends DevhelmCommand {
  static description = 'List network requests a run made (status, timing, failures)'
  static examples = ['<%= config.bin %> runs network <run-id> --failed']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {
    ...commonFlags,
    failed: Flags.boolean({description: 'Only failed requests', default: false}),
    slow: Flags.boolean({description: 'Only slow requests', default: false}),
    xhr: Flags.boolean({description: 'Only XHR/fetch requests', default: false}),
    attempt: Flags.integer({description: 'Attempt number (fast retries)'}),
  }

  async run() {
    const {args, flags} = await this.parse(RunsNetwork)
    const query: Record<string, string | number | boolean> = {}
    if (flags.failed) query.failed = true
    if (flags.slow) query.slow = true
    if (flags.xhr) query.xhr = true
    if (flags.attempt !== undefined) query.attempt = flags.attempt
    const net = parse(apiSchemas.RunNetworkDto, await apiGet(this.client(), `/api/v1/runs/${args.id}/network`, {query}), `GET /api/v1/runs/${args.id}/network`)
    const rows = net.data
    await this.finish({
      data: net,
      human: () => this.log(formatOutput(rows, 'table', [
        {header: 'METHOD', get: (r: (typeof rows)[number]) => r.method},
        {header: 'STATUS', get: (r: (typeof rows)[number]) => (r.failure ? `✗ ${r.failure}` : String(r.status ?? ''))},
        {header: 'MS', get: (r: (typeof rows)[number]) => String(r.durationMs ?? '')},
        {header: 'URL', get: (r: (typeof rows)[number]) => r.url},
      ])),
    })
  }
}
