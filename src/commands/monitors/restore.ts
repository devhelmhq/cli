import {Flags} from '@oclif/core'
import {checkedFetch} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {findTrashed} from '../../lib/monitors/trash.js'
import {isUuid, resolveEnvironment} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsRestore extends DevhelmCommand {
  static description = 'Restore a monitor from Trash (restored paused; status-page bindings come back)'
  static examples = ['<%= config.bin %> monitors restore <id>', '<%= config.bin %> monitors restore Checkout --into-env staging']
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    'into-env': Flags.string({description: 'Environment slug to restore a code monitor into (default: its own)'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRestore)
    const client = this.client()
    let id = args.monitor
    if (!isUuid(id)) {
      const matches = (await findTrashed(client)).filter((m) => m.name === id && (!flags.env || m.environment?.slug === flags.env))
      if (matches.length !== 1) {
        throw new ValidationError(
          matches.length === 0 ? `No monitor named "${id}" in Trash` : `${matches.length} monitors named "${id}" in Trash; pass an id: ${matches.map((m) => m.id).join(', ')}`,
          {code: matches.length === 0 ? 'MONITOR_NOT_FOUND' : 'MONITOR_AMBIGUOUS', next: {command: 'devhelm monitors trash list', docs: null}},
        )
      }
      id = matches[0]!.id
    }
    const body = parse(apiSchemas.RestoreMonitorRequest, flags['into-env'] ? {environmentId: (await resolveEnvironment(client, flags['into-env'])).id} : {}, 'restore body invalid')
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/restore', {params: {path: {id}}, body}))
    await this.finish({data: resp?.data ?? null, human: () => this.log(`Monitor '${resp?.data?.name ?? id}' restored (paused). Resume with: devhelm monitors resume ${id}`)})
  }
}
