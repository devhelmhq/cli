import {Command} from '@oclif/core'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'

export default class Version extends Command {
  static override description = 'Print the CLI version'
  static override examples = ['<%= config.bin %> version']

  async run(): Promise<void> {
    await this.parse(Version)
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'))
    this.log(`devhelm/${pkg.version} ${process.platform}-${process.arch} node-${process.version}`)
  }
}
