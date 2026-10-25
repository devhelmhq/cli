import {mkdirSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {Args, Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {getRawBytes} from '../../lib/cli/raw.js'

export default class RunsExport extends DevhelmCommand {
  static description = 'Export a run with its evidence as a zip (kept past evidence expiry, for postmortems)'
  static examples = ['<%= config.bin %> runs export <run-id> --dir ./postmortem']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags, dir: Flags.string({description: 'Directory to write run-<id>.zip into', required: true})}

  async run() {
    const {args, flags} = await this.parse(RunsExport)
    const bytes = await getRawBytes(this.client(), `/api/v1/runs/${args.id}/export`, 'application/zip')
    const dir = resolve(flags.dir)
    mkdirSync(dir, {recursive: true})
    const path = join(dir, `run-${args.id}.zip`)
    writeFileSync(path, bytes)
    await this.finish({data: {runId: args.id, path, bytes: bytes.byteLength}, human: () => this.log(`Wrote ${path} (${bytes.byteLength} bytes)`)})
  }
}
