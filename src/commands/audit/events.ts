import {Flags} from '@oclif/core'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {parseSince} from '../../lib/cli/flags.js'
import {formatOutput} from '../../lib/output.js'

export default class AuditEvents extends DevhelmCommand {
  static description = 'List audit-log events (who changed what, when)'
  static examples = [
    '<%= config.bin %> audit events --since 24h',
    '<%= config.bin %> audit events --action monitor.updated --actor 42',
  ]
  static flags = {
    ...commonFlags,
    actor: Flags.integer({description: 'Only events by this user id'}),
    action: Flags.string({description: 'Only this action, e.g. monitor.updated'}),
    'resource-type': Flags.string({description: 'Only this resource type, e.g. monitor'}),
    resource: Flags.string({description: 'Only this resource id'}),
    since: Flags.string({description: 'Events after this time (ISO-8601 or a duration like 24h)'}),
    limit: Flags.integer({description: 'Maximum events (1–200)', default: 50, min: 1, max: 200}),
  }

  async run() {
    const {flags} = await this.parse(AuditEvents)
    const query: Record<string, string | number> = {page: 0, size: flags.limit}
    if (flags.actor !== undefined) query.actorId = flags.actor
    if (flags.action) query.action = flags.action
    if (flags['resource-type']) query.resourceType = flags['resource-type']
    if (flags.resource) query.resourceId = flags.resource
    if (flags.since) query.from = parseSince(flags.since)
    const page = await apiGetPage(this.client(), '/api/v1/audit-log', apiSchemas.AuditEventDto, {query})
    const rows = page.data
    await this.finish({
      data: rows,
      human: () => this.log(formatOutput(rows, 'table', [
        {header: 'WHEN', get: (r: (typeof rows)[number]) => r.createdAt},
        {header: 'ACTOR', get: (r: (typeof rows)[number]) => r.actorEmail ?? String(r.actorId ?? '')},
        {header: 'ACTION', get: (r: (typeof rows)[number]) => r.action},
        {header: 'RESOURCE', get: (r: (typeof rows)[number]) => [r.resourceType, r.resourceName ?? r.resourceId].filter(Boolean).join(' ')},
      ])),
    })
  }
}
