import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class AccountUsage extends DevhelmCommand {
  static description = 'Show synthetics usage for the current billing period (browser and API runs, per monitor)'
  static examples = ['<%= config.bin %> account usage', '<%= config.bin %> account usage -o json']
  static flags = {...commonFlags}

  async run() {
    await this.parse(AccountUsage)
    const usage = await apiGetSingle(this.client(), '/api/v1/synthetics/usage', apiSchemas.SyntheticsUsagePeriodDto)
    const meter = (label: string, m: {used: number; included?: number | null; testRuns: number}) =>
      `  ${label}: ${m.used.toLocaleString('en-US')} / ${m.included === null || m.included === undefined ? 'unlimited' : m.included.toLocaleString('en-US')} runs` +
      ` (${m.testRuns.toLocaleString('en-US')} validation)` +
      (m.included !== null && m.included !== undefined ? ` · ${Math.max(0, m.included - m.used).toLocaleString('en-US')} remaining` : '')
    await this.finish({
      data: usage,
      human: () => {
        this.log(`Period ${usage.periodStart} → ${usage.periodEnd}`)
        this.log(meter('browser', usage.browser))
        this.log(meter('api', usage.api))
        const top = [...usage.monitors].sort((a, b) => b.runs - a.runs).slice(0, 10)
        if (top.length > 0) {
          this.log('  top monitors:')
          for (const m of top) this.log(`    ${m.monitorName ?? m.monitorId}${m.deleted ? ' (deleted)' : ''} · ${m.meter} · ${m.runs} runs (${m.testRuns} validation)`)
        }
      },
    })
  }
}
