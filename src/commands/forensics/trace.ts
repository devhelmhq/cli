import {Args, Command} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {formatOutput, OutputFormat} from '../../lib/output.js'

export default class ForensicsTrace extends Command {
  static description = 'Show everything the detection engine recorded for a single check execution'
  static examples = ['<%= config.bin %> forensics trace a1b2c3d4-…']
  static flags = {...globalFlags}
  static args = {
    'check-id': Args.string({description: 'Check execution ID (UUID, minted by the scheduler)', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(ForensicsTrace)
    const client = buildClient(flags)
    const trace = await apiGetSingle(
      client,
      `/api/v1/forensics/traces/${args['check-id']}`,
      apiSchemas.CheckTraceDto,
    )

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(trace, format))
      return
    }

    this.log('')
    this.log(`  Check ${trace.checkId}`)
    this.log('')
    this.log(`  Evaluations (${trace.evaluations.length})`)
    for (const e of trace.evaluations) {
      const matched = e.outputMatched ? 'MATCH' : 'miss '
      this.log(`    ${e.occurredAt}  ${matched}  rule=${e.ruleType} region=${e.region}`)
    }
    this.log('')
    this.log(`  Transitions (${trace.transitions.length})`)
    for (const t of trace.transitions) {
      this.log(`    ${t.occurredAt}  ${t.fromStatus} → ${t.toStatus}  reason=${t.reason}`)
    }
    if (trace.policySnapshot) {
      this.log('')
      this.log(`  Policy snapshot: ${trace.policySnapshot.hashHex.slice(0, 16)}…`)
    }
    this.log('')
  }
}
