import {Args} from '@oclif/core'
import {apiGetSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {ValidationError} from '../../../lib/errors.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

export default class MonitorsRevisionsDiff extends DevhelmCommand {
  static description = 'Diff two revisions; with one id, compare it with the live revision'
  static examples = [
    '<%= config.bin %> monitors revisions diff Checkout <revision-id>',
    '<%= config.bin %> monitors revisions diff Checkout <revision-id> <other-revision-id>',
  ]
  static args = {
    monitor: monitorArg,
    revision: Args.string({description: 'Revision id', required: true}),
    other: Args.string({description: 'Other revision id (default: the live revision)'}),
  }
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsDiff)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    // Two ids: left = first, right = second. One id: left = live, right = it.
    const [left, right] = args.other ? [args.revision, args.other] : [monitor.liveRevisionId, args.revision]
    if (!left) throw new ValidationError(`${monitor.name} has no live revision to compare with; pass two revision ids`, {code: 'REVISION_NOT_FOUND'})
    const diff = await apiGetSingle(client, `/api/v1/revisions/${left}/diff/${right}`, apiSchemas.RevisionDiffDto)
    await this.finish({data: diff, human: () => {
      this.log(`#${diff.left.number} (${diff.left.id}) → #${diff.right.number} (${diff.right.id})`)
      if (diff.hunks.length === 0) this.log('no changes')
      for (const h of diff.hunks) {
        const mark = h.change === 'added' ? '+' : h.change === 'removed' ? '-' : '~'
        this.log(`${mark} ${h.path}`)
        if (h.change === 'changed' && h.left !== undefined && h.right !== undefined) {
          const left = (h.left ?? '').split('\n')
          const right = (h.right ?? '').split('\n')
          for (const l of left) if (!right.includes(l)) this.log(`    - ${l}`)
          for (const r of right) if (!left.includes(r)) this.log(`    + ${r}`)
        }
      }
    }})
  }
}
