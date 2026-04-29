import {Command, Flags} from '@oclif/core'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {buildClient, display, globalFlags} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

interface EvalRow {
  occurredAt: string
  ruleType: string
  region: string
  outputMatched: boolean
  checkId: string
  policySnapshotHashHex: string
}

const COLUMNS: ColumnDef<EvalRow>[] = [
  {header: 'WHEN', get: (r) => r.occurredAt},
  {header: 'RULE', get: (r) => r.ruleType},
  {header: 'REGION', get: (r) => r.region},
  {header: 'MATCHED', get: (r) => (r.outputMatched ? 'yes' : 'no')},
  {header: 'CHECK', get: (r) => r.checkId.slice(0, 8)},
  {header: 'POLICY', get: (r) => r.policySnapshotHashHex.slice(0, 12)},
]

export default class ForensicsEvaluations extends Command {
  static description = 'List rule evaluations produced for a monitor (paginated)'
  static examples = [
    '<%= config.bin %> forensics evaluations --monitor-id 5f4…',
    '<%= config.bin %> forensics evaluations --monitor-id 5f4… --only-matched',
    '<%= config.bin %> forensics evaluations --monitor-id 5f4… --rule-type consecutive_failures --region us-east',
  ]
  static flags = {
    ...globalFlags,
    'monitor-id': Flags.string({description: 'Monitor ID (UUID)', required: true}),
    'rule-type': Flags.string({description: 'Filter by rule type'}),
    region: Flags.string({description: 'Filter by probe region'}),
    'only-matched': Flags.boolean({description: 'Return only evaluations that fired'}),
    from: Flags.string({description: 'ISO-8601 lower bound (occurredAt >= from)'}),
    to: Flags.string({description: 'ISO-8601 upper bound (occurredAt < to)'}),
    page: Flags.integer({description: 'Page index (0-based)', default: 0}),
    size: Flags.integer({description: 'Page size', default: 50}),
  }

  async run() {
    const {flags} = await this.parse(ForensicsEvaluations)
    const client = buildClient(flags)

    const params: Record<string, unknown> = {page: flags.page, size: flags.size}
    if (flags['rule-type']) params.ruleType = flags['rule-type']
    if (flags.region) params.region = flags.region
    if (flags['only-matched']) params.onlyMatched = true
    if (flags.from) params.from = flags.from
    if (flags.to) params.to = flags.to

    const result = await apiGetPage(
      client,
      `/api/v1/forensics/monitors/${flags['monitor-id']}/rule-evaluations`,
      apiSchemas.RuleEvaluationDto,
      params,
    )

    display(this, result.data, flags.output, COLUMNS as ColumnDef[])
  }
}
