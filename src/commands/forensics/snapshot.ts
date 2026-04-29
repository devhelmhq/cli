import {Args, Command} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {formatOutput, OutputFormat} from '../../lib/output.js'

export default class ForensicsSnapshot extends Command {
  static description = 'Fetch a policy snapshot by its content-addressed SHA-256 hash'
  static examples = ['<%= config.bin %> forensics snapshot 5a1f…']
  static flags = {...globalFlags}
  static args = {
    hash: Args.string({description: 'Snapshot hash (lowercase hex, SHA-256)', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(ForensicsSnapshot)
    const client = buildClient(flags)
    const snapshot = await apiGetSingle(
      client,
      `/api/v1/forensics/policy-snapshots/${args.hash}`,
      apiSchemas.PolicySnapshotDto,
    )

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(snapshot, format))
      return
    }

    this.log('')
    this.log(`  Hash:          ${snapshot.hashHex}`)
    this.log(`  Engine:        ${snapshot.engineVersion}`)
    this.log(`  First seen at: ${snapshot.firstSeenAt}`)
    this.log(`  Last seen at:  ${snapshot.lastSeenAt}`)
    this.log('')
    this.log('  Policy')
    this.log(
      JSON.stringify(snapshot.policy, null, 2)
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n'),
    )
    this.log('')
  }
}
