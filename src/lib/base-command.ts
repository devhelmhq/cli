import {Command, Flags} from '@oclif/core'
import {createApiClient, type ApiClient} from './api-client.js'
import {resolveToken, resolveApiUrl} from './auth.js'
import {AuthError} from './errors.js'
import {formatOutput, OutputFormat, ColumnDef} from './output.js'
import {urlFlag} from './validators.js'

export const globalFlags = {
  output: Flags.string({
    char: 'o',
    description: 'Output format',
    options: ['table', 'json', 'yaml'],
    default: 'table',
  }),
  'api-url': urlFlag({description: 'Override API base URL'}),
  'api-token': Flags.string({description: 'Override API token'}),
  verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
}

export function buildClient(flags: {
  'api-url'?: string
  'api-token'?: string
  verbose?: boolean
}): ApiClient {
  const token = flags['api-token'] || resolveToken()
  if (!token) throw new AuthError()

  const baseUrl = flags['api-url'] || resolveApiUrl()

  return createApiClient({baseUrl, token, verbose: flags.verbose})
}

const VALID_FORMATS = new Set<string>(['table', 'json', 'yaml'])

export function display(
  command: Command,
  data: unknown,
  format: string,
  columns?: ColumnDef[],
): void {
  if (!VALID_FORMATS.has(format)) format = 'table'
  command.log(formatOutput(data, format as OutputFormat, columns))
}
