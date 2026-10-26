import {apiDelete} from '../../lib/api-client.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {ownerLabel, resolveMonitor} from '../../lib/monitors/resolve.js'

export default class MonitorsDelete extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Delete a monitor (moves it to Trash; `monitors restore` brings it back)'
  static examples = ['<%= config.bin %> monitors delete <id> --yes', '<%= config.bin %> monitors delete Checkout --env staging --yes']
  static args = {id: monitorArg}
  static flags = {...commonFlags, ...yesFlag, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsDelete)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.id, {env: flags.env})
    await this.confirm({
      action: 'monitor.delete',
      changes: [{monitor: monitor.name, id: monitor.id, environment: monitor.environment?.slug ?? null, owner: ownerLabel(monitor), action: 'delete'}],
      confirmCommand: `devhelm monitors delete ${monitor.id} --yes`,
      yes: flags.yes,
      prompt: `Delete monitor '${monitor.name}' (${monitor.id})?`,
    })
    await apiDelete(client, `/api/v1/monitors/${monitor.id}`)
    await this.finish({
      data: {id: monitor.id, name: monitor.name, deleted: true},
      human: () => this.log(`monitor '${monitor.id}' deleted. Undo: devhelm monitors restore ${monitor.id}`),
    })
  }
}
