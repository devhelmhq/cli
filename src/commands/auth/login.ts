import {Flags} from '@oclif/core'
import {apiGet, apiGetSingle, createApiClient} from '../../lib/api-client.js'
import {saveContext, resolveApiUrl} from '../../lib/auth.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {readStdin} from '../../lib/cli/secret-value.js'
import {deviceLogin} from '../../lib/device-login.js'
import {AuthError, DevhelmError, noTokenError} from '../../lib/errors.js'

export default class AuthLogin extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Authenticate with the DevHelm API. On a terminal this opens a device-code login you approve in the dashboard; ' +
    'without a TTY pass --token-stdin or set DEVHELM_API_TOKEN.'
  static examples = [
    '<%= config.bin %> auth login',
    'printf %s "$DEVHELM_API_TOKEN" | <%= config.bin %> auth login --token-stdin',
    '<%= config.bin %> auth login --name staging --api-url https://api.staging.example',
  ]
  static flags = {
    ...commonFlags,
    token: Flags.string({description: 'API token (prefer --token-stdin: arguments end up in shell history)'}),
    'token-stdin': Flags.boolean({description: 'Read the API token from stdin', default: false}),
    name: Flags.string({description: 'Context name', default: 'default'}),
    'no-browser': Flags.boolean({description: 'Print the login URL instead of opening a browser', default: false}),
  }

  async run() {
    const {flags} = await this.parse(AuthLogin)
    const apiUrl = flags['api-url'] || resolveApiUrl()

    let token = flags.token
    if (!token && flags['token-stdin']) token = (await readStdin()).trim()
    if (!token && process.env.DEVHELM_API_TOKEN) token = process.env.DEVHELM_API_TOKEN

    if (!token) {
      if (this.nonInteractive) throw noTokenError()
      const result = await deviceLogin(apiUrl, {
        openBrowser: !flags['no-browser'],
        onPrompt: (a) => {
          this.logToStderr(`Open ${a.verificationUriComplete}`)
          this.logToStderr(`and confirm the code ${a.userCode}`)
          this.logToStderr('Waiting for approval…')
        },
      })
      saveContext({name: flags.name, apiUrl, token: result.token, orgId: result.orgId, workspaceId: result.workspaceId}, true)
      await this.finish({
        data: {context: flags.name, apiUrl, organizationId: result.orgId ?? null, workspaceId: result.workspaceId ?? null},
        human: () => {
          this.log('')
          this.log('  Authenticated successfully.')
          this.log(`  Context '${flags.name}' saved to ~/.devhelm/contexts.json`)
        },
      })
      return
    }

    if (!this.structured) this.log('Validating token...')
    const client = createApiClient({baseUrl: apiUrl, token})
    try {
      const me = await apiGetSingle(client, '/api/v1/auth/me', apiSchemas.AuthMeResponse)
      saveContext({name: flags.name, apiUrl, token, orgId: me.organization.id}, true)
      await this.finish({
        data: {context: flags.name, apiUrl, organization: me.organization, key: {id: me.key.id, name: me.key.name, scopes: me.key.scopes}, plan: me.plan.tier},
        human: () => {
          this.log('')
          this.log('  Authenticated successfully.')
          this.log(`  Organization: ${me.organization.name} (ID: ${me.organization.id})`)
          this.log(`  Key:          ${me.key.name}`)
          this.log(`  Plan:         ${me.plan.tier}`)
          this.log('')
          this.log(`  Context '${flags.name}' saved to ~/.devhelm/contexts.json`)
        },
      })
      return
    } catch (err) {
      if (err instanceof DevhelmError && err.category === 'transport') throw err
      // /auth/me describes API keys only; a dashboard session token is checked below.
    }

    try {
      await apiGet(client, '/api/v1/dashboard/overview')
    } catch (err) {
      if (err instanceof DevhelmError && err.category === 'transport') throw err
      throw new AuthError('Invalid token. Authentication failed.', {code: 'INVALID_TOKEN', next: {command: 'devhelm auth login', docs: null}})
    }
    saveContext({name: flags.name, apiUrl, token}, true)
    await this.finish({
      data: {context: flags.name, apiUrl},
      human: () => {
        this.log('')
        this.log('  Authenticated successfully.')
        this.log(`  Context '${flags.name}' saved to ~/.devhelm/contexts.json`)
      },
    })
  }
}
