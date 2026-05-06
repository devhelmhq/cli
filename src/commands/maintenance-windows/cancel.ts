import {Command, Flags} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {apiDelete, apiGetSingle} from '../../lib/api-client.js'
import {DevhelmAuthError, DevhelmNotFoundError, EXIT_CODES} from '../../lib/errors.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import type {components} from '../../lib/api.generated.js'
import {uuidArg} from '../../lib/validators.js'

type MaintenanceWindowDto = components['schemas']['MaintenanceWindowDto']

export default class MaintenanceWindowsCancel extends Command {
  static description = 'Cancel a maintenance window (deletes scheduled or active windows)'
  static examples = [
    '<%= config.bin %> maintenance-windows cancel <id>',
    '<%= config.bin %> maintenance-windows cancel <id> --yes',
  ]
  static args = {id: uuidArg({description: 'Maintenance window ID', required: true})}
  static flags = {
    ...globalFlags,
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip the interactive confirmation prompt',
      default: false,
    }),
  }

  async run() {
    const {args, flags} = await this.parse(MaintenanceWindowsCancel)
    const client = buildClient(flags)
    const path = `/api/v1/maintenance-windows/${args.id}`

    if (!flags.yes) {
      if (!process.stdin.isTTY) {
        // Mirrors the safety check in the generic `delete` factory: in
        // CI / piped invocations we refuse to silently confirm.
        this.error(
          `Refusing to cancel maintenance window '${args.id}' in non-interactive mode without --yes (or -y).`,
          {exit: EXIT_CODES.VALIDATION},
        )
      }
      const confirmed = await promptForCancel(client, path, args.id)
      if (!confirmed) {
        this.log('Cancelled.')
        return
      }
    }

    await apiDelete(client, path)
    this.log(`Maintenance window '${args.id}' cancelled.`)
  }
}

async function promptForCancel(
  client: ReturnType<typeof buildClient>,
  path: string,
  id: string,
): Promise<boolean> {
  let label = `'${id}'`
  try {
    const value = await apiGetSingle<MaintenanceWindowDto>(
      client,
      path,
      apiSchemas.MaintenanceWindowDto as ZodType<MaintenanceWindowDto>,
    )
    const reason = value.reason ?? '(no reason)'
    label = `'${reason}' (${id}, ${value.startsAt} → ${value.endsAt})`
  } catch (err) {
    // Surface auth/not-found before the destructive action; swallow
    // anything else so we still prompt with the bare id rather than
    // blocking a cancel that would otherwise succeed.
    if (err instanceof DevhelmAuthError || err instanceof DevhelmNotFoundError) throw err
  }

  const {createInterface} = await import('node:readline')
  const rl = createInterface({input: process.stdin, output: process.stderr})
  const answer = await new Promise<string>((resolve) => {
    rl.question(`Cancel maintenance window ${label}? [y/N] `, resolve)
  })
  rl.close()
  const normalized = answer.trim().toLowerCase()
  return normalized === 'y' || normalized === 'yes'
}
