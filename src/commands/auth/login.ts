import {Command, Flags} from '@oclif/core'
import {globalFlags} from '../../lib/base-command.js'
import {ApiClient, SingleResponse} from '../../lib/api-client.js'
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
    const client = new ApiClient({baseUrl: apiUrl, token})
    try {
      const me = await client.get<SingleResponse<{email: string}>>('/platform/me')
      saveContext({name: flags.name, apiUrl, token}, true)
      this.log(`\nAuthenticated as ${me.content.email}`)
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
