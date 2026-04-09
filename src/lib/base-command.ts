import {Command, Flags} from '@oclif/core'
import {ApiClient} from './api-client.js'
import {resolveToken, resolveApiUrl} from './auth.js'
import {AuthError} from './errors.js'
import {formatOutput, OutputFormat, ColumnDef} from './output.js'

export const globalFlags = {
  output: Flags.string({
    char: 'o',
    description: 'Output format',
    options: ['table', 'json', 'yaml'],
    default: 'table',
  }),
  'api-url': Flags.string({description: 'Override API base URL'}),
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

  return new ApiClient({baseUrl, token, verbose: flags.verbose})
}

export function display(
  command: Command,
  data: unknown,
  format: string,
  columns?: ColumnDef[],
): void {
  command.log(formatOutput(data, format as OutputFormat, columns))
}
