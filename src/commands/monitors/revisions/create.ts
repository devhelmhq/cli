import {Flags} from '@oclif/core'
import {checkedFetch} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {ValidationError} from '../../../lib/errors.js'
import {codeFromFlag} from '../../../lib/monitors/code-flag.js'
import {isCodeType, resolveMonitor} from '../../../lib/monitors/resolve.js'
import {parse, parseSingle} from '../../../lib/response-validation.js'

export default class MonitorsRevisionsCreate extends DevhelmCommand {
  static description = 'Create a draft revision from a local file (reuses a draft with the same code). Then: revisions test, publish'
  static examples = ['<%= config.bin %> monitors revisions create Checkout --env production --code synthetics/checkout.spec.ts']
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    code: Flags.string({description: 'Entry file of the check', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsCreate)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    if (!isCodeType(monitor.type)) throw new ValidationError(`${monitor.name} is ${monitor.type}; revisions apply to BROWSER and MULTI_STEP_API monitors`, {code: 'MONITOR_CODE_TYPE_REQUIRED'})
    const body = parse(apiSchemas.CreateDraftRevisionRequest, {code: await codeFromFlag(client, flags.code)}, 'draft body invalid')
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/revisions', {params: {path: {id: monitor.id}}, body}))
    const created = parseSingle(apiSchemas.CreateDraftRevisionResponse, resp, `POST /api/v1/monitors/${monitor.id}/revisions`)
    if (created.evicted) this.addWarning(`Draft #${created.evicted.number} (${created.evicted.id}) was discarded to stay under the draft limit`)
    const rv = created.revision
    await this.finish({data: created, human: () => {
      this.log(`Draft #${rv.number} ${rv.id} · ${rv.digest}`)
      this.log(`  next: devhelm monitors revisions test ${monitor.id} ${rv.id}`)
    }})
  }
}
