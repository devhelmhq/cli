import {Flags} from '@oclif/core'
import {apiGetCursorPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, parseSince} from '../../lib/cli/flags.js'
import {resolveEnvironment, resolveMonitor} from '../../lib/monitors/resolve.js'
import {formatOutput} from '../../lib/output.js'
import {isFlaky, runSymbol} from '../../lib/runs/outcome.js'
import type {RunDto} from '../../lib/runs/wait.js'

export default class RunsList extends DevhelmCommand {
  static description = 'List runs (browser and multi-step API). Defaults to the last 24 hours'
  static examples = [
    '<%= config.bin %> runs list --monitor Checkout --env production --outcome failed',
    '<%= config.bin %> runs list --session "$GITHUB_RUN_ID"',
    '<%= config.bin %> runs list --flaky --since 7d',
  ]
  static flags = {
    ...commonFlags,
    monitor: Flags.string({description: 'Monitor id or exact name'}),
    env: envFlag,
    outcome: Flags.string({description: 'passed, failed, execution_error, timed_out, cancelled or inconclusive'}),
    source: Flags.string({description: 'schedule, run_now, ci, fast_retry, remote_validation, deployment_validation or session_renew'}),
    session: Flags.string({description: 'CI session id (test and trigger runs of one CI job share it)'}),
    flaky: Flags.boolean({description: 'Only runs that passed after a fast retry', allowNo: true}),
    since: Flags.string({description: 'Runs after this time (ISO-8601 or a duration like 24h; max 90d)'}),
    limit: Flags.integer({description: 'Maximum runs to return', default: 25, min: 1, max: 1000}),
    adhoc: Flags.boolean({description: 'Include validation runs that belong to no monitor', default: false}),
  }

  async run() {
    const {flags} = await this.parse(RunsList)
    const client = this.client()
    const query: Record<string, string | number | boolean> = {}
    if (flags.monitor) query.monitorId = (await resolveMonitor(client, flags.monitor, {env: flags.env})).id
    if (flags.env) query.environmentId = (await resolveEnvironment(client, flags.env)).id
    if (flags.outcome) query.outcome = flags.outcome
    if (flags.source) query.source = flags.source
    if (flags.session) query.sessionId = flags.session
    if (flags.flaky !== undefined) query.flaky = flags.flaky
    if (flags.since) query.from = parseSince(flags.since)
    if (flags.adhoc) query.adhoc = true

    const runs: RunDto[] = []
    let cursor: string | undefined
    while (runs.length < flags.limit) {
      const page = await apiGetCursorPage(client, '/api/v1/runs', apiSchemas.RunDto, {
        query: {...query, limit: Math.min(100, flags.limit - runs.length), ...(cursor ? {cursor} : {})},
      })
      runs.push(...page.data)
      if (!page.hasMore || !page.nextCursor) break
      cursor = page.nextCursor
    }
    await this.finish({
      data: runs,
      human: () => this.log(formatOutput(runs, 'table', [
        {header: '', get: (r: RunDto) => runSymbol(r)},
        {header: 'ID', get: (r: RunDto) => r.id},
        {header: 'MONITOR', get: (r: RunDto) => r.monitorName ?? r.monitorId ?? ''},
        {header: 'REGION', get: (r: RunDto) => r.region},
        {header: 'SOURCE', get: (r: RunDto) => r.source},
        {header: 'OUTCOME', get: (r: RunDto) => (r.phase === 'finished' ? `${r.outcome ?? ''}${isFlaky(r) ? ' (flaky)' : ''}` : r.phase)},
        {header: 'ENQUEUED', get: (r: RunDto) => r.enqueuedAt},
      ])),
    })
  }
}
