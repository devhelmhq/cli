import {Command, Args} from '@oclif/core'
import {readState, writeState, removeStateEntry, StateFileCorruptError} from '../../lib/yaml/state.js'

export default class StateRm extends Command {
  static description = 'Remove a resource from the state file (does not delete from API)'

  static examples = [
    '<%= config.bin %> state rm monitors.API',
    '<%= config.bin %> state rm statusPages.devhelm',
  ]

  static args = {
    address: Args.string({
      description: 'Resource address to remove (e.g. monitors.API)',
      required: true,
    }),
  }

  async run() {
    const {args} = await this.parse(StateRm)
    let state
    try {
      state = readState()
    } catch (err) {
      if (err instanceof StateFileCorruptError) {
        this.error(err.message, {exit: 1})
      }
      throw err
    }

    if (!state) {
      this.error('No state file found.', {exit: 1})
    }

    const removed = removeStateEntry(state, args.address)
    if (!removed) {
      this.error(`Address "${args.address}" not found in state.`, {exit: 1})
    }

    writeState(state)
    this.log(`Removed "${args.address}" from state.`)
  }
}
