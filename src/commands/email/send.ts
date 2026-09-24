import {Command} from '@oclif/core'
import {DevhelmValidationError} from '../../lib/errors.js'

export default class EmailSend extends Command {
  static description = 'Not a command. Use email receive to accept a test message'
  static hidden = true
  static flags = {}

  async run() {
    throw new DevhelmValidationError('`email send` does not exist. Use `devhelm email receive`.')
  }
}
