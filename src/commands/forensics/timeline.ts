import {Args, Command} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {formatOutput, OutputFormat} from '../../lib/output.js'

export default class ForensicsTimeline extends Command {
  static description = "Show the full forensic timeline for an incident (state transitions, triggering evaluations, active policy snapshot)"
  static examples = ['<%= config.bin %> forensics timeline 5f4…']
  static flags = {...globalFlags}
  static args = {
    id: Args.string({description: 'Incident ID (UUID)', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(ForensicsTimeline)
    const client = buildClient(flags)
    const timeline = await apiGetSingle(
      client,
      `/api/v1/forensics/incidents/${args.id}/timeline`,
      apiSchemas.IncidentTimelineDto,
    )

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(timeline, format))
      return
    }

    this.log('')
    this.log(`  Incident ${args.id}`)
    this.log('')
    this.log('  Transitions')
    for (const t of timeline.transitions) {
      const evalIds = t.triggeringEvaluationIds?.length
        ? ` evals=${t.triggeringEvaluationIds.length}`
        : ''
      this.log(
        `    ${t.occurredAt}  ${t.fromStatus} → ${t.toStatus}  reason=${t.reason}  check=${t.checkId}${evalIds}`,
      )
    }
    this.log('')
    this.log(`  Triggering evaluations (${timeline.triggeringEvaluations.length})`)
    for (const e of timeline.triggeringEvaluations) {
      const matched = e.outputMatched ? 'MATCH' : 'miss '
      this.log(
        `    ${e.occurredAt}  ${matched}  rule=${e.ruleType} region=${e.region} check=${e.checkId}`,
      )
    }
    if (timeline.policySnapshot) {
      this.log('')
      this.log(`  Policy snapshot: ${timeline.policySnapshot.hashHex.slice(0, 16)}…`)
    }
    this.log('')
  }
}
