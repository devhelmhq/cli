import {Command, Flags} from '@oclif/core'
import type {components} from '../../lib/api.generated.js'
import {createApiClient} from '../../lib/api-client.js'
import {resolveToken, resolveApiUrl} from '../../lib/auth.js'
import {EXIT_CODES} from '../../lib/errors.js'
import {urlFlag} from '../../lib/validators.js'
import {fetchAllRefs} from '../../lib/yaml/resolver.js'
import {allHandlers} from '../../lib/yaml/handlers.js'
import {fetchPaginated} from '../../lib/typed-api.js'
import {writeState, buildState, readState, StateFileCorruptError} from '../../lib/yaml/state.js'
import type {ChildStateEntry} from '../../lib/yaml/state.js'

type Schemas = components['schemas']

export default class StatePull extends Command {
  static description = 'Reconstruct the state file from the current API state'

  static examples = [
    '<%= config.bin %> state pull',
    '<%= config.bin %> state pull --dry-run',
  ]

  static flags = {
    'dry-run': Flags.boolean({description: 'Show what would be written without saving', default: false}),
    'api-url': urlFlag({description: 'Override API base URL'}),
    'api-token': Flags.string({description: 'Override API token'}),
    verbose: Flags.boolean({char: 'v', description: 'Show verbose output', default: false}),
  }

  async run() {
    const {flags} = await this.parse(StatePull)

    const token = flags['api-token'] ?? resolveToken()
    if (!token) {
      this.error(
        'No API token configured. Run "devhelm auth login" or set DEVHELM_API_TOKEN.',
        {exit: EXIT_CODES.VALIDATION},
      )
    }

    const client = createApiClient({
      baseUrl: flags['api-url'] ?? resolveApiUrl(),
      token,
      verbose: flags.verbose,
    })

    this.log('Fetching all resources from API...')
    const refs = await fetchAllRefs(client)
    const handlers = allHandlers()

    const entries: Array<{
      resourceType: Parameters<typeof buildState>[0][number]['resourceType']
      refKey: string
      apiId: string
      children?: Record<string, ChildStateEntry>
    }> = []

    for (const handler of handlers) {
      for (const entry of refs.allEntries(handler.refType)) {
        let children: Record<string, ChildStateEntry> | undefined
        if (handler.resourceType === 'statusPage') {
          children = await this.pullStatusPageChildren(client, entry.id)
        }
        entries.push({
          resourceType: handler.resourceType,
          refKey: entry.refKey,
          apiId: entry.id,
          children,
        })
      }
    }

    let prevState
    try {
      prevState = readState()
    } catch (err) {
      if (err instanceof StateFileCorruptError) {
        this.warn(`Existing state file is corrupt (${err.cause instanceof Error ? err.cause.message : String(err.cause)}); rebuilding from scratch.`)
        prevState = undefined
      } else {
        throw err
      }
    }
    const state = buildState(entries, prevState?.serial ?? 0)

    if (flags['dry-run']) {
      this.log(`\nWould write ${entries.length} resources to state:`)
      for (const [addr, entry] of Object.entries(state.resources)) {
        const childCount = Object.keys(entry.children).length
        this.log(`  ${addr}${childCount > 0 ? `  (${childCount} children)` : ''}`)
      }
      return
    }

    writeState(state)
    this.log(`State rebuilt with ${entries.length} resources (serial ${state.serial}).`)
  }

  /**
   * Fetch identity (id only) for groups and components belonging to a
   * status page and flatten them into the `children` shape used by
   * StateEntry. Keys are `groups.<name>` / `components.<name>` so the
   * child-reconciler's state-aware rename matching keeps working after
   * a pull.
   *
   * As of state v3 (RFC 0001), only the apiId is stored. Attributes are
   * always re-fetched from the API at plan time, so there is nothing to
   * snapshot here — pull becomes purely an identity-recovery operation.
   */
  private async pullStatusPageChildren(
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
        children[`groups.${name}`] = {apiId: String(g.id ?? '')}
      }
      const components = await fetchPaginated<Schemas['StatusPageComponentDto']>(
        client, `/api/v1/status-pages/${pageId}/components`,
      )
      for (const c of components) {
        const name = c.name ?? ''
        if (!name) continue
        children[`components.${name}`] = {apiId: String(c.id ?? '')}
      }
    } catch (err) {
      this.warn(`Failed to fetch children for status page ${pageId}: ${err instanceof Error ? err.message : String(err)}`)
    }
    return children
  }
}
