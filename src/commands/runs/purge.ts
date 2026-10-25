import {Args, Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../../lib/cli/command.js'
import {parse} from '../../lib/response-validation.js'

export default class RunsPurge extends DevhelmCommand {
  static description = 'Delete a run\'s evidence (artifacts, logs, console, network) — e.g. after a leaked secret. The run and its outcome stay'
  static examples = ['<%= config.bin %> runs purge <run-id> --reason "token printed in console" --yes']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags, ...yesFlag, reason: Flags.string({description: 'Why the evidence is purged (audited)', required: true})}

  async run() {
    const {args, flags} = await this.parse(RunsPurge)
    const body = parse(apiSchemas.EvidencePurgeRequest, {reason: flags.reason}, 'Invalid purge request')
    await this.confirm({
      action: 'run.purge',
      changes: [{run: args.id, purge: 'evidence', reason: flags.reason}],
      confirmCommand: `devhelm runs purge ${args.id} --reason ${JSON.stringify(flags.reason)} --yes`,
      yes: flags.yes,
      prompt: `Permanently delete the evidence of run ${args.id}?`,
    })
    const run = await apiPostSingle(this.client(), `/api/v1/runs/${args.id}/purge`, apiSchemas.RunDto, body)
    await this.finish({data: run, human: () => this.log(`Purged the evidence of run ${run.id}.`)})
  }
}
