import {Command, Flags} from '@oclif/core'
import {apiPost, unwrapData} from '../../lib/api-client.js'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {asRecord, listTable} from '../../lib/inbound.js'

export default class EmailAddress extends Command {
  static description = 'Print a new mailbox on the workspace mail host'
  static examples = ['<%= config.bin %> email address --label signup']
  static flags = {
    ...globalFlags,
    label: Flags.string({description: 'Local-part prefix'}),
    domain: Flags.string({description: 'Use this host instead of the assigned one'}),
  }

  async run() {
    const {flags} = await this.parse(EmailAddress)
    const client = buildClient(flags)
    const host = flags.domain ?? (await assignedDomain(client))
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    const localPart = flags.label ? `${flags.label}-${suffix}` : suffix
    const email = `${localPart}@${host}`
    if (flags.output === 'table') {
      this.log(email)
      return
    }
    this.log(JSON.stringify({email, domain: host, localPart}, null, 2))
  }
}

async function assignedDomain(client: ReturnType<typeof buildClient>): Promise<string> {
  const rows = await listTable(client, '/api/v1/email/domains')
  const existing = rows.find((row) => row.kind === 'assigned' && row.status === 'active')
  if (existing && typeof existing.name === 'string') return existing.name
  const created = asRecord(unwrapData(await apiPost(client, '/api/v1/email/domains', {})))
  return String(created.name)
}
