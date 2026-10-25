import {Flags} from '@oclif/core'
import {apiDelete} from '../lib/api-client.js'
import {DevhelmCommand, commonFlags, confirmationToken} from '../lib/cli/command.js'
import {CliExitError, ConfirmationRequiredError, DevhelmError, EXIT_CODES, ValidationError, type JsonValue} from '../lib/errors.js'
import {fetchPaginated} from '../lib/typed-api.js'
import type {components} from '../lib/api.generated.js'
import {isGitOwner} from '../lib/yaml/project-context.js'

type MonitorDto = components['schemas']['MonitorDto']

export default class Destroy extends DevhelmCommand {
  static description =
    'Delete every monitor this project owns (Git-owned with ownerProject == project). Typed confirmation on a terminal; ' +
    'without one it needs --confirm <token> (printed with exit 15)'

  static examples = ['<%= config.bin %> destroy --project acme/web', '<%= config.bin %> destroy --project acme/web --confirm cft_…']

  static flags = {
    ...commonFlags,
    project: Flags.string({description: 'Project whose monitors are deleted', required: true}),
    confirm: Flags.string({description: 'Confirmation token for exactly this change list'}),
  }

  async run() {
    const {flags} = await this.parse(Destroy)
    const client = this.client()
    await this.loadMeta()
    const all = await fetchPaginated<MonitorDto>(client, '/api/v1/monitors', 100, {managedBy: 'GIT'})
    const owned = all.filter((m) => isGitOwner(m.owner?.type ?? m.managedBy) && m.owner?.project === flags.project)
    const changes: JsonValue[] = owned.map((m) => ({delete: 'monitor', id: m.id, name: m.name, environment: m.environment?.slug ?? null}))
    if (owned.length === 0) {
      await this.finish({data: {deleted: []}, human: () => this.log(`No monitors are owned by ${flags.project}.`)})
      return
    }
    const token = confirmationToken(`destroy:${flags.project}`, changes)
    const confirmCommand = `devhelm destroy --project ${flags.project} --confirm ${token}`
    if (flags.confirm) {
      if (flags.confirm !== token) throw new ValidationError('The confirmation token does not match the current change list; re-run without --confirm to see it', {code: 'CONFIRMATION_TOKEN_MISMATCH'})
    } else if (!this.nonInteractive && !this.structured) {
      this.log(`This deletes ${owned.length} monitor(s) owned by ${flags.project}:`)
      for (const m of owned) this.log(`  - ${m.name} (${m.environment?.slug ?? '-'})`)
      const {createInterface} = await import('node:readline')
      const rl = createInterface({input: process.stdin, output: process.stderr})
      const typed = await new Promise<string>((resolve) => rl.question(`Type the project name (${flags.project}) to confirm: `, resolve))
      rl.close()
      if (typed.trim() !== flags.project) throw new CliExitError('Cancelled', 'confirmation_required', EXIT_CODES.CONFIRMATION_REQUIRED, {code: 'CANCELLED'})
    } else {
      throw new ConfirmationRequiredError(`Destroying ${owned.length} monitor(s) owned by ${flags.project} needs --confirm`, {
        code: 'CONFIRMATION_REQUIRED',
        next: {command: confirmCommand, docs: null},
        details: {action: 'project.destroy', changes, confirmCommand},
      })
    }
    const deleted: string[] = []
    const failed: Array<{name: string; error: string}> = []
    for (const m of owned) {
      try {
        await apiDelete(client, `/api/v1/monitors/${m.id}`)
        deleted.push(m.name)
      } catch (err) {
        if (!(err instanceof DevhelmError)) throw err
        failed.push({name: m.name, error: err.message})
      }
    }
    await this.finish({
      exit: failed.length > 0 ? EXIT_CODES.PARTIAL_FAILURE : EXIT_CODES.SUCCESS,
      data: {deleted, failed},
      human: () => {
        this.log(`Deleted ${deleted.length} monitor(s) owned by ${flags.project} (restorable from Trash: devhelm monitors trash list).`)
        for (const f of failed) this.log(`  ✗ ${f.name}: ${f.error}`)
      },
    })
  }
}
