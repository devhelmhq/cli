import {Args, Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {getRevision, getRevisionFiles, writeFiles} from '../../../lib/monitors/revisions.js'

export default class MonitorsRevisionsGet extends DevhelmCommand {
  static description = 'Show one revision; --files prints or downloads its code'
  static examples = [
    '<%= config.bin %> monitors revisions get Checkout <revision-id>',
    '<%= config.bin %> monitors revisions get Checkout <revision-id> --files --dir ./rv',
  ]
  static args = {monitor: monitorArg, revision: Args.string({description: 'Revision id', required: true})}
  static flags = {
    ...commonFlags,
    env: envFlag,
    files: Flags.boolean({description: 'Include the revision files', default: false}),
    dir: Flags.string({description: 'With --files: write the files under this directory'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsGet)
    const client = this.client()
    await resolveMonitor(client, args.monitor, {env: flags.env})
    const revision = await getRevision(client, args.revision)
    if (!flags.files) {
      await this.finish({data: revision, human: () => this.log(table(revision))})
      return
    }
    const files = await getRevisionFiles(client, args.revision)
    if (flags.dir) {
      const written = writeFiles(flags.dir, files.files)
      await this.finish({data: {revision, entrypoint: files.entrypoint, written}, human: () => {
        this.log(`Wrote ${written.length} file(s) to ${flags.dir} (entrypoint ${files.entrypoint})`)
      }})
      return
    }
    await this.finish({data: {revision, files}, human: () => {
      this.log(table(revision))
      for (const [path, text] of Object.entries(files.files)) {
        this.log(`\n── ${path}${path === files.entrypoint ? ' (entrypoint)' : ''}`)
        this.log(text)
      }
    }})
  }
}
