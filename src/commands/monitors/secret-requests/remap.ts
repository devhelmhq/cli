import {Args, Flags} from '@oclif/core'
import {apiGetPage, apiPutSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {NotFoundError} from '../../../lib/errors.js'
import {isUuid, resolveMonitor} from '../../../lib/monitors/resolve.js'
import {parse} from '../../../lib/response-validation.js'

export default class MonitorsSecretRequestsRemap extends DevhelmCommand {
  static description = 'Fulfil a requested key from a differently named workspace secret'
  static examples = ['<%= config.bin %> monitors secret-requests remap Checkout CARD_TOKEN --secret STRIPE_TEST_CARD --env production']
  static args = {monitor: monitorArg, key: Args.string({description: 'Requested key', required: true})}
  static flags = {
    ...commonFlags,
    env: envFlag,
    secret: Flags.string({description: 'Workspace secret key or id that fulfils it (omit to clear the mapping)'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsSecretRequestsRemap)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    let secretId: string | null = null
    if (flags.secret) {
      if (isUuid(flags.secret)) {
        secretId = flags.secret
      } else {
        const secrets = await apiGetPage(client, '/api/v1/secrets', apiSchemas.SecretDto, {query: {page: 0, size: 200}})
        const hit = secrets.data.find((s) => s.key === flags.secret)
        if (!hit) throw new NotFoundError(`Secret "${flags.secret}" not found`, {code: 'SECRET_NOT_FOUND', next: {command: 'devhelm secrets list', docs: null}})
        secretId = hit.id
      }
    }
    const body = parse(apiSchemas.RemapSecretRequest, {secretId}, 'remap body invalid')
    const dto = await apiPutSingle(client, `/api/v1/monitors/${monitor.id}/secret-requests/${encodeURIComponent(args.key)}`, apiSchemas.MonitorSecretRequestsDto, body)
    await this.finish({data: dto, human: () => this.log(`${args.key} → ${flags.secret ?? '(default mapping)'}`)})
  }
}
