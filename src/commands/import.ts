import {Command, Args, Flags} from '@oclif/core'
import type {components} from '../lib/api.generated.js'
import {createApiClient} from '../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../lib/auth.js'
import {fetchAllRefs} from '../lib/yaml/resolver.js'
import {allHandlers} from '../lib/yaml/handlers.js'
import {fetchPaginated} from '../lib/typed-api.js'
import {readState, writeState, emptyState, upsertStateEntry, resourceAddress, StateFileCorruptError} from '../lib/yaml/state.js'
import type {ChildStateEntry} from '../lib/yaml/state.js'
import type {HandledResourceType} from '../lib/yaml/types.js'

type Schemas = components['schemas']

const VALID_TYPES = [
  'monitor', 'tag', 'environment', 'secret', 'alertChannel',
  'notificationPolicy', 'webhook', 'resourceGroup', 'dependency', 'statusPage',
] as const

export default class Import extends Command {
  static description = 'Import an existing API resource into the deploy state (adopt without recreating)'

  static examples = [
    '<%= config.bin %> import monitor "API Health Check"',
    '<%= config.bin %> import statusPage devhelm',
    '<%= config.bin %> import tag production',
  ]

  static args = {
    type: Args.string({
      description: `Resource type (${VALID_TYPES.join(', ')})`,
      required: true,
    }),
    name: Args.string({
      description: 'Resource name or slug to import',
      required: true,
    }),
  }

  static flags = {
    'api-url': Flags.string({description: 'Override API base URL'}),
    'api-token': Flags.string({description: 'Override API token'}),
    verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  }

  async run() {
    const {args, flags} = await this.parse(Import)

    if (!VALID_TYPES.includes(args.type as typeof VALID_TYPES[number])) {
      this.error(`Unknown resource type "${args.type}". Valid types: ${VALID_TYPES.join(', ')}`, {exit: 1})
    }

    const resourceType = args.type as HandledResourceType

    const token = flags['api-token'] ?? resolveToken()
    if (!token) {
      this.error('No API token configured. Run "devhelm auth login" or set DEVHELM_API_TOKEN.', {exit: 1})
    }

    const client = createApiClient({
      baseUrl: flags['api-url'] ?? resolveApiUrl(),
      token,
      verbose: flags.verbose,
    })

    const handler = allHandlers().find((h) => h.resourceType === resourceType)
    if (!handler) {
      this.error(`No handler for resource type "${resourceType}"`, {exit: 1})
    }

    this.log(`Fetching ${resourceType} resources...`)
    const refs = await fetchAllRefs(client)

    const entry = refs.get(handler.refType, args.name)
    if (!entry) {
      const available = refs.allEntries(handler.refType).map((e) => e.refKey)
      this.error(
        `${resourceType} "${args.name}" not found in API.\n` +
        (available.length > 0
          ? `Available: ${available.join(', ')}`
          : 'No resources of this type exist.'),
        {exit: 1},
      )
    }

    let state
    try {
      state = readState() ?? emptyState()
    } catch (err) {
      if (err instanceof StateFileCorruptError) {
        this.error(err.message, {exit: 1})
      }
      throw err
    }
    const addr = resourceAddress(resourceType, args.name)

    if (state.resources[addr]) {
      this.log(`"${addr}" is already in state (API ID: ${state.resources[addr].apiId}).`)
      return
    }

    let children: Record<string, ChildStateEntry> = {}
    if (resourceType === 'statusPage') {
      children = await this.fetchStatusPageChildren(client, entry.id)
    }

    upsertStateEntry(state, resourceType, args.name, entry.id, {name: args.name}, children)
    writeState(state)

    const childCount = Object.keys(children).length
    this.log(`Imported "${addr}" → ${entry.id}${childCount > 0 ? ` (with ${childCount} children)` : ''}`)
    this.log('The resource is now tracked in state. Add it to your devhelm.yml and run "devhelm plan" to verify.')
  }

  private async fetchStatusPageChildren(
    client: ReturnType<typeof createApiClient>,
    pageId: string,
  ): Promise<Record<string, ChildStateEntry>> {
    const children: Record<string, ChildStateEntry> = {}
    try {
      const groups = await fetchPaginated<Schemas['StatusPageComponentGroupDto']>(
        client, `/api/v1/status-pages/${pageId}/groups`,
      )
      for (const g of groups) {
        const name = g.name ?? ''
        if (!name) continue
        children[`groups.${name}`] = {apiId: String(g.id ?? ''), attributes: {name}}
      }
      const components = await fetchPaginated<Schemas['StatusPageComponentDto']>(
        client, `/api/v1/status-pages/${pageId}/components`,
      )
      for (const c of components) {
        const name = c.name ?? ''
        if (!name) continue
        children[`components.${name}`] = {apiId: String(c.id ?? ''), attributes: {name}}
      }
    } catch (err) {
      this.warn(`Failed to fetch status page children: ${err instanceof Error ? err.message : String(err)}`)
    }
    return children
  }
}
