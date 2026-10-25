/**
 * The CLI's local gate for public status-page writes (doc 42 §6.5), until
 * the server confirmation envelope ships on these routes:
 *
 *   - without a TTY, the caller must decide on notification explicitly:
 *     `--notify-subscribers` or `--no-notify-subscribers` (exit 4 if absent);
 *   - `--yes` never satisfies a public write. It needs `--confirm <token>`,
 *     where the token is computed from the exact action, page, text and
 *     audience. Any change to the text invalidates it. Without it: exit 15
 *     with `changes[]` and the `confirmCommand`.
 *   - on a TTY the human is shown the text and asked.
 */
import {Flags} from '@oclif/core'
import {CliExitError, ConfirmationRequiredError, EXIT_CODES, ValidationError, type JsonValue} from '../errors.js'
import {confirmationToken, isNonInteractive, yesFlag} from './command.js'

export const publicWriteFlags = {
  /** Accepted like everywhere else, but it never confirms a public write. */
  ...yesFlag,
  'notify-subscribers': Flags.boolean({
    description: 'Notify status page subscribers (required as --notify-subscribers or --no-notify-subscribers without a TTY)',
    allowNo: true,
  }),
  confirm: Flags.string({description: 'Confirmation token printed by a previous run for this exact text and audience'}),
}

export interface PublicWrite {
  action: string
  page: string
  target?: string
  text: {[key: string]: JsonValue}
  notifySubscribers: boolean | undefined
  confirm: string | undefined
  /** argv used to build the confirm command. */
  argv: string[]
}

function quote(arg: string): string {
  return /^[A-Za-z0-9_./:=@-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`
}

/**
 * Run the gate. Returns the notify decision to send. Throws exit 4 / 15
 * errors as described above.
 */
export async function gatePublicWrite(w: PublicWrite): Promise<boolean> {
  const interactive = !isNonInteractive()
  let notify = w.notifySubscribers
  if (notify === undefined) {
    if (!interactive) {
      throw new ValidationError('Public status-page writes need an explicit --notify-subscribers or --no-notify-subscribers', {
        code: 'NOTIFY_DECISION_REQUIRED',
        next: {command: [...w.argv, '--no-notify-subscribers'].map(quote).join(' '), docs: null},
      })
    }
    notify = await ask('Notify subscribers? (y/N) ')
  }
  const changes: JsonValue[] = [{action: w.action, page: w.page, target: w.target ?? null, ...w.text, notifySubscribers: notify}]
  const token = confirmationToken(w.action, changes)
  if (w.confirm !== undefined) {
    if (w.confirm === token) return notify
    throw new ValidationError('The --confirm token does not match this exact text and audience; re-run without it to get a new one', {
      code: 'CONFIRMATION_TOKEN_MISMATCH',
    })
  }
  if (interactive) {
    process.stderr.write(`${JSON.stringify(changes[0], null, 2)}\n`)
    if (await ask('Publish this to the public status page? (y/N) ')) return notify
    throw new CliExitError('Cancelled', 'confirmation_required', EXIT_CODES.CONFIRMATION_REQUIRED, {code: 'CANCELLED'})
  }
  const base = w.argv.filter((a, i, all) =>
    a !== '--yes' && a !== '-y' &&
    !(a === '--confirm' || all[i - 1] === '--confirm') &&
    !(a === '--api-token' || all[i - 1] === '--api-token' || a.startsWith('--api-token=')))
  const withNotify = base.some((a) => a === '--notify-subscribers' || a === '--no-notify-subscribers')
    ? base
    : [...base, notify ? '--notify-subscribers' : '--no-notify-subscribers']
  const confirmCommand = [...withNotify, '--confirm', token].map(quote).join(' ')
  throw new ConfirmationRequiredError(`Confirmation required: ${w.action} is public. --yes does not confirm public writes`, {
    code: 'CONFIRMATION_REQUIRED',
    next: {command: confirmCommand, docs: null},
    details: {action: w.action, changes, confirmCommand, confirmationToken: token},
  })
}

async function ask(question: string): Promise<boolean> {
  const {createInterface} = await import('node:readline')
  const rl = createInterface({input: process.stdin, output: process.stderr})
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve))
  rl.close()
  return /^y(es)?$/i.test(answer.trim())
}

/** `devhelm <topic> <verb> …argv` for a command, used to print confirm commands. */
export function commandLine(id: string | undefined, argv: string[]): string[] {
  return ['devhelm', ...(id ?? '').split(':').filter(Boolean), ...argv]
}
