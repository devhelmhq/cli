import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {parseAlertChannelsFlag, setAlertChannels} from '../../lib/monitor-alert-channels.js'
import {uuidArg} from '../../lib/validators.js'

/**
 * Replace the alert channel set linked to a monitor.
 *
 * Standalone subcommand for the common workflow of attaching channels
 * to an existing monitor without re-running `monitors update`. Pass
 * `--channel-ids ""` (empty) to clear all channels — matching the
 * semantics of the underlying `PUT /api/v1/monitors/{id}/alert-channels`
 * which always replaces the full list.
 */
export default class MonitorsSetChannels extends Command {
  static description = 'Replace the alert channel set linked to a monitor'

  static examples = [
    '<%= config.bin %> monitors set-channels <id> --channel-ids ch-1,ch-2',
    '<%= config.bin %> monitors set-channels <id> --channel-ids ""',
  ]

  static args = {
    id: uuidArg({description: 'monitor id', required: true}),
  }

  static flags = {
    ...globalFlags,
    'channel-ids': Flags.string({
      description:
        'Comma-separated alert channel IDs (replaces current list; pass empty string to clear all channels)',
      required: true,
    }),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsSetChannels)
    const client = buildClient(flags)
    const ids = parseAlertChannelsFlag(flags['channel-ids']) ?? []
    await setAlertChannels(args.id as string, ids, client)
    if (ids.length === 0) {
      this.log(`Cleared all alert channels from monitor '${args.id}'.`)
    } else {
      this.log(
        `Linked ${ids.length} alert channel(s) to monitor '${args.id}': ${ids.join(', ')}`,
      )
    }
  }
}
