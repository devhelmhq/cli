/**
 * Secret values come from stdin or a named environment variable, never
 * from a command-line argument (doc 42 R10): arguments land in shell
 * history, process listings and CI logs.
 */
import {ValidationError} from '../errors.js'

export interface SecretValueFlags {
  'value-stdin'?: boolean
  'from-env'?: string
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  return Buffer.concat(chunks).toString('utf8')
}

/** Strip one trailing newline (what `echo` / heredocs add). */
function trimNewline(v: string): string {
  return v.replace(/\r?\n$/, '')
}

/** Read the value per flags; undefined when neither flag was given. */
export async function readSecretValue(flags: SecretValueFlags): Promise<string | undefined> {
  if (flags['value-stdin'] && flags['from-env']) {
    throw new ValidationError('Pass either --value-stdin or --from-env, not both', {code: 'FIELD_INVALID_FORMAT'})
  }
  if (flags['from-env']) {
    const v = process.env[flags['from-env']]
    if (v === undefined || v === '') {
      throw new ValidationError(`Environment variable ${flags['from-env']} is not set or empty`, {code: 'FIELD_REQUIRED'})
    }
    return v
  }
  if (flags['value-stdin']) {
    if (process.stdin.isTTY) {
      throw new ValidationError('--value-stdin reads from a pipe: printf %s "$VALUE" | devhelm …', {code: 'FIELD_REQUIRED'})
    }
    const v = trimNewline(await readStdin())
    if (v === '') throw new ValidationError('No value on stdin', {code: 'FIELD_REQUIRED'})
    return v
  }
  return undefined
}

/** Like readSecretValue, but one of the two sources is required. */
export async function requireSecretValue(flags: SecretValueFlags, key: string, env?: string): Promise<string> {
  const v = await readSecretValue(flags)
  if (v === undefined) {
    const envArg = env ? ` --env ${env}` : ' --env <slug>'
    throw new ValidationError(`Pass the value with --value-stdin or --from-env VAR (never as an argument)`, {
      code: 'FIELD_REQUIRED',
      next: {command: `printf %s "$${key}" | devhelm secrets values set ${key}${envArg} --value-stdin`, docs: null},
    })
  }
  return v
}
