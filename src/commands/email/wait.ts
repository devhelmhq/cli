import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {MESSAGE_COLUMNS, postWait, show, unwrapKey, waitOrExplain} from '../../lib/inbound.js'

export default class EmailWait extends Command {
  static description = 'Wait for mail to a full address'
  static examples = ['<%= config.bin %> email wait --to signup@example.devhelmmail.com']
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
    'timeout-ms': Flags.integer({description: 'How long to wait, in milliseconds', default: 30000}),
    'subject-contains': Flags.string({description: 'Subject must contain this text'}),
    'received-after': Flags.string({
      description: 'Ignore mail received before this timestamp. Omit for the server lookback of 60 seconds',
    }),
  }

  async run() {
    const {flags} = await this.parse(EmailWait)
    const body: Record<string, unknown> = {
      to: flags.to,
      timeoutMs: flags['timeout-ms'],
    }
    if (flags['received-after']) body.receivedAfter = flags['received-after']
    if (flags['subject-contains']) body.subjectContains = flags['subject-contains']
    const raw = await waitOrExplain(this, flags.to, () =>
      postWait(buildClient(flags), '/api/v1/email/wait', body, flags['timeout-ms']),
    )
    const message = unwrapKey(raw, 'message')
    if (flags.output === 'table') {
      show(this, [message], flags.output, MESSAGE_COLUMNS)
      return
    }
    show(this, message, flags.output)
  }
}
