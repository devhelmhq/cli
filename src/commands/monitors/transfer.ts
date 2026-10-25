import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {ownerWire} from '../../lib/monitors/owner.js'
import {ownerLabel, resolveMonitor} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsTransfer extends DevhelmCommand {
  static description = 'Move ownership of a monitor to another tool (audited; confirmation-gated)'
  static examples = [
    '<%= config.bin %> monitors transfer Checkout --env production --to git --project acme/web --reason "managed in devhelm.yml" --yes',
    '<%= config.bin %> monitors transfer <id> --to dashboard --reason "hand back to on-call" --yes',
  ]
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    ...yesFlag,
    env: envFlag,
    to: Flags.string({description: 'New owner', options: ['dashboard', 'git', 'terraform', 'api'], required: true}),
    reason: Flags.string({description: 'Why ownership moves (audited, max 280)', required: true}),
    project: Flags.string({description: 'Project the new owner declares, e.g. acme/web'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsTransfer)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const before = ownerLabel(monitor)
    const to = ownerWire(flags.to)
    const after = flags.project ? `${to === 'CLI' ? 'GIT' : to} · ${flags.project}` : (to === 'CLI' ? 'GIT' : to)
    const previous = (monitor.owner?.type ?? monitor.managedBy ?? 'API').toLowerCase().replace('cli', 'git')
    const body = parse(apiSchemas.TransferMonitorRequest, {to, reason: flags.reason, ...(flags.project ? {project: flags.project} : {})}, 'transfer body invalid')
    await this.confirm({
      action: 'monitor.transfer',
      changes: [{monitor: monitor.name, id: monitor.id, from: before, to: after}],
      confirmCommand: `devhelm monitors transfer ${monitor.id} --to ${flags.to} --reason ${JSON.stringify(flags.reason)}${flags.project ? ` --project ${flags.project}` : ''} --yes`,
      yes: flags.yes,
      prompt: `Transfer ${monitor.name} from ${before} to ${after}?`,
    })
    const updated = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/transfer`, apiSchemas.MonitorDto, body)
    await this.finish({data: {monitor: updated, before, after: ownerLabel(updated)}, human: () => {
      this.log(`✓ ${monitor.name}: owner ${before} → ${ownerLabel(updated)}`)
      this.log(`  undo: devhelm monitors transfer ${monitor.id} --to ${previous} --reason "undo transfer"`)
    }})
  }
}
