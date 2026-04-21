import {Command, Flags} from '@oclif/core'
import {globalFlags} from '../../lib/base-command.js'
import {createApiClient, checkedFetch, apiGet} from '../../lib/api-client.js'
import {saveContext, resolveApiUrl} from '../../lib/auth.js'
import {EXIT_CODES} from '../../lib/errors.js'
import * as readline from 'node:readline'

export default class AuthLogin extends Command {
  static description = 'Authenticate with the DevHelm API'
  static examples = ['<%= config.bin %> auth login', '<%= config.bin %> auth login --token dh_live_...']
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
      const resp = await checkedFetch(client.GET('/api/v1/auth/me'))
      const me = resp?.data
      if (!me) {
        throw new Error('Empty response')
      }

      saveContext({name: flags.name, apiUrl, token}, true)
      this.log('')
      this.log(`  Authenticated successfully.`)
      this.log(`  Organization: ${me.organization?.name ?? 'unknown'} (ID: ${me.organization?.id ?? '?'})`)
      this.log(`  Key:          ${me.key?.name ?? 'unknown'}`)
      this.log(`  Plan:         ${me.plan?.tier ?? 'unknown'}`)
      this.log('')
      this.log(`  Context '${flags.name}' saved to ~/.devhelm/contexts.json`)
      return
    } catch {
      // /auth/me failed — might be a non-API-key token; try basic validation
    }

    try {
      await apiGet(client, '/api/v1/dashboard/overview')
      saveContext({name: flags.name, apiUrl, token}, true)
      this.log('')
      this.log(`  Authenticated successfully.`)
      this.log(`  Context '${flags.name}' saved to ~/.devhelm/contexts.json`)
    } catch {
      // Token rejected by the API. Surface as DevhelmAuthError-equivalent
      // (exit 11 — same as any other 4xx) so scripts can branch on the
      // canonical API error code instead of a bespoke "auth login" exit.
      this.error('Invalid token. Authentication failed.', {exit: EXIT_CODES.API})
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
