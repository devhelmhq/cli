import {Command, Flags} from '@oclif/core'
import {EXIT_CODES} from '../../lib/errors.js'
import {readState, StateFileCorruptError} from '../../lib/yaml/state.js'

export default class StateShow extends Command {
  static description = 'Display the current deploy state file'

  static examples = [
    '<%= config.bin %> state show',
    '<%= config.bin %> state show --json',
  ]

  static flags = {
    json: Flags.boolean({description: 'Output raw JSON', default: false}),
  }

  async run() {
    const {flags} = await this.parse(StateShow)
    let state
    try {
      state = readState()
    } catch (err) {
      if (err instanceof StateFileCorruptError) {
        this.error(err.message, {exit: EXIT_CODES.VALIDATION})
      }
      throw err
    }

    if (!state) {
      this.log('No state file found. Run "devhelm deploy" to create one.')
      return
    }

    if (flags.json) {
      this.log(JSON.stringify(state, null, 2))
      return
    }

    this.log(`State version: ${state.version}`)
    this.log(`Serial: ${state.serial}`)
    this.log(`Last deployed: ${state.lastDeployedAt}`)

    const entries = Object.entries(state.resources)
    if (entries.length === 0) {
      this.log('\nNo resources tracked.')
      return
    }

    this.log(`\nResources (${entries.length}):`)
    for (const [address, entry] of entries) {
      this.log(`  ${address}  →  ${entry.apiId}`)
      for (const [ck, child] of Object.entries(entry.children)) {
        this.log(`    ${ck}  →  ${child.apiId}`)
      }
    }
  }
}
