import {Command, Flags} from '@oclif/core'
import {globalFlags} from '../../lib/base-command.js'
import {createApiClient, checkedFetch} from '../../lib/api-client.js'
import {saveContext, resolveApiUrl} from '../../lib/auth.js'
import * as readline from 'node:readline'

export default class AuthLogin extends Command {
  static description = 'Authenticate with the DevHelm API'
  static examples = ['<%= config.bin %> auth login', '<%= config.bin %> auth login --token sk_live_...']
  static flags = {
    ...globalFlags,
    token: Flags.string({description: 'API token (skips interactive prompt)'}),
    name: Flags.string({description: 'Context name', default: 'default'}),
  }

  async run() {
    const {flags} = await this.parse(AuthLogin)
    let token = flags.token
    if (!token) {
      token = await this.promptForToken()
    }

    const apiUrl = flags['api-url'] || resolveApiUrl()
    this.log('Validating token...')
    const client = createApiClient({baseUrl: apiUrl, token})
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const me = await checkedFetch(client.GET('/platform/me' as any, {} as any))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const email = (me as any)?.data?.email ?? (me as any)?.email
      saveContext({name: flags.name, apiUrl, token}, true)
      this.log(`\nAuthenticated as ${email}`)
      this.log(`Context '${flags.name}' saved to ~/.devhelm/contexts.json`)
    } catch {
      this.error('Invalid token. Authentication failed.', {exit: 2})
    }
  }

  private promptForToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({input: process.stdin, output: process.stderr})
      rl.question('Enter your DevHelm API token: ', (answer) => {
        rl.close()
        const trimmed = answer.trim()
        if (!trimmed) { reject(new Error('Token cannot be empty')); return }
        resolve(trimmed)
      })
    })
  }
}
