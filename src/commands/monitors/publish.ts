import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsPublish extends DevhelmCommand {
  static description = 'Publish a revision as the live code of a monitor'
  static examples = [
    '<%= config.bin %> monitors publish Checkout --revision <revision-id> --require-tested',
    '<%= config.bin %> monitors publish <id> --revision <revision-id> --expected-live <live-revision-id>',
  ]
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    revision: Flags.string({description: 'Revision to publish', required: true}),
    'require-tested': Flags.boolean({description: 'Refuse unless the revision passed a test in this environment in the last 24 h', default: false}),
    force: Flags.boolean({description: 'Skip the --require-tested check (needs scope monitors:publish_untested)', default: false}),
    'expected-live': Flags.string({description: 'Refuse if the live revision is no longer this one'}),
    'acknowledge-rollback': Flags.string({description: 'Rolled-back digest this publish re-applies on purpose'}),
    note: Flags.string({description: 'Note recorded with the publish (max 280)'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsPublish)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const body: Record<string, unknown> = {revisionId: flags.revision}
    if (flags['require-tested']) body.requireTested = true
    if (flags.force) body.force = true
    if (flags['expected-live']) body.expectedLiveRevisionId = flags['expected-live']
    if (flags['acknowledge-rollback']) body.acknowledgeRollback = flags['acknowledge-rollback']
    if (flags.note) body.note = flags.note
    const head = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/publish`, apiSchemas.DefinitionHeadDto,
      parse(apiSchemas.PublishRevisionRequest, body, 'publish body invalid'))
    await this.finish({data: head, human: () => {
      this.log(`✓ ${monitor.name} (${head.environment.slug}) is live on revision #${head.revision.number} ${head.revision.id}`)
      this.log(`  digest ${head.revision.digest}`)
    }})
  }
}
