import {Flags} from '@oclif/core'
import {apiGetSingle, apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {repoWarning} from '../../lib/monitors/repo-warning.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsRollback extends DevhelmCommand {
  static description = 'Roll a monitor back to an earlier live revision (default: the previous one). Lists the affected monitors and linked incidents first'
  static examples = [
    '<%= config.bin %> monitors rollback Checkout --env production --reason "provider v2 returns 503"',
    '<%= config.bin %> monitors rollback <id> --revision <revision-id> --reason "bad deploy" --emergency --yes',
  ]
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    ...yesFlag,
    env: envFlag,
    revision: Flags.string({description: 'Revision to roll back to (default: the previous live revision)'}),
    reason: Flags.string({description: 'Why (recorded; at least 10 characters for --emergency)', required: true}),
    emergency: Flags.boolean({description: 'Roll back a monitor owned elsewhere during a confirmed incident (scope monitors:rollback)', default: false}),
    'expected-live': Flags.string({description: 'Refuse if the live revision is no longer this one'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRollback)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const previewPath = `/api/v1/monitors/${monitor.id}/rollback-preview${flags.revision ? `?revisionId=${encodeURIComponent(flags.revision)}` : ''}`
    const preview = await apiGetSingle(client, previewPath, apiSchemas.RollbackPreviewDto)
    const affected = preview.affectedMonitors.map((m) => `${m.name} (${m.environment?.slug ?? '-'})`)
    const incidents = preview.current?.linkedIncidents ?? []
    this.human(`Roll back ${monitor.name} to revision #${preview.target.number} ${preview.target.id}`)
    this.human(`  affected: ${affected.length > 0 ? affected.join(', ') : `${monitor.name} only`}`)
    for (const i of incidents) this.human(`  open incident: ${i.id} · ${i.status}${i.title ? ` · ${i.title}` : ''}`)

    if (flags.emergency || preview.affectedMonitors.length > 1) {
      await this.confirm({
        action: flags.emergency ? 'monitor.rollback.emergency' : 'monitor.rollback',
        changes: preview.affectedMonitors.map((m) => ({monitor: m.name, id: m.id, from: preview.current?.revision.id ?? null, to: preview.target.id})),
        confirmCommand: `devhelm monitors rollback ${monitor.id} --revision ${preview.target.id} --reason ${JSON.stringify(flags.reason)}${flags.emergency ? ' --emergency' : ''} --yes`,
        yes: flags.yes,
        prompt: `Roll back ${preview.affectedMonitors.length} monitor(s)?`,
      })
    }

    const body: Record<string, unknown> = {reason: flags.reason}
    if (flags.revision) body.revisionId = flags.revision
    if (flags.emergency) body.emergency = true
    if (flags['expected-live']) body.expectedLiveRevisionId = flags['expected-live']
    const head = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/rollback`, apiSchemas.DefinitionHeadDto,
      parse(apiSchemas.RollbackRevisionRequest, body, 'rollback body invalid'))
    const warning = await repoWarning({
      cwd: process.cwd(), name: monitor.name, envSlug: monitor.environment?.slug, liveDigest: head.revision.digest,
      previousRevisionId: preview.current?.revision.id,
    })
    if (warning.length > 0) this.warnings.push(warning.join(' '))
    await this.finish({data: {head, preview}, human: () => {
      this.log(`✓ ${monitor.name} (${head.environment.slug}) is on #${head.revision.number} ${head.revision.id}${preview.current ? ` (was ${preview.current.revision.id})` : ''}`)
      for (const w of warning) this.log(`! ${w}`)
    }})
  }
}
