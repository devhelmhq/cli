import {Command, Args, Flags, type Interfaces} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient, display} from './base-command.js'
import {fetchPaginatedValidated} from './typed-api.js'
import {apiDelete, apiGetSingle, apiPostSingle, apiPutSingle, type ApiClient} from './api-client.js'
import {DevhelmAuthError, DevhelmNotFoundError, EXIT_CODES} from './errors.js'
import type {ColumnDef} from './output.js'
import {parse as parseSchema} from './response-validation.js'
import {uuidArg} from './validators.js'

type Arg<T> = Interfaces.Arg<T>

/**
 * Base config shared by every CRUD command (list / get / delete).
 *
 * `T` is the response DTO type (e.g. `MonitorDto`, `IncidentDto`) and
 * is intentionally _not_ defaulted: every call site MUST supply the
 * concrete DTO (`ResourceConfig<MonitorDto>`) so `responseSchema`,
 * `columns`, and the parsed value from the API stay in sync. A
 * `T = unknown` default would silently let a resource declare itself
 * with no DTO and surface as `unknown` everywhere downstream.
 *
 * All fields here are required so the factory has no fall-back paths
 * for "schema missing" — every resource is wired into runtime
 * validation. The narrower {@link CreatableResource} /
 * {@link UpdatableResource} extensions add the request-side schemas
 * and body builders that only `create` / `update` need.
 */
export interface ResourceConfig<T> {
  name: string
  plural: string
  apiPath: string
  /** Field name used as the resource identifier (default: 'id'). */
  idField?: string
  /** Set to false to skip UUID validation on the id arg (e.g. for slug/key ids). */
  validateIdAsUuid?: boolean
  columns: ColumnDef<T>[]
  /**
   * Zod schema for the response DTO — always imported from
   * `api-zod.generated.ts` so it tracks the OpenAPI spec exactly. The
   * CRUD factory routes single-item responses through `parseSingle`
   * (envelope `.strict()` — P1) and list responses through
   * `fetchPaginatedValidated`, so unknown response fields raise a typed
   * `ValidationError` at the API boundary rather than flowing silently
   * into `display()` and surfacing as a confusing downstream crash.
   */
  responseSchema: ZodType<T>
  /**
   * Optional response schema for the `get <id>` endpoint when it
   * returns a richer detail DTO than the list/entity DTO (e.g. incident
   * `get` returns `IncidentDetailDto` with the update timeline; list
   * returns the flat `IncidentDto`). Defaults to `responseSchema` when
   * the entity DTO is the same on both endpoints.
   */
  getResponseSchema?: ZodType<unknown>
}

/**
 * Resources that expose a `create` command. The `createRequestSchema`
 * (e.g. `apiSchemas.CreateMonitorRequest`) is parsed against the
 * builder's output before POSTing, so invalid input fails locally with
 * a typed `ValidationError` and a path into the offending field —
 * instead of a generic 400 from the API.
 *
 * `ZodType<object>` (rather than `ZodTypeAny`) constrains the schema to
 * one whose inferred output extends `object` — every generated request
 * schema is `z.object(...)` so this fits, but it would correctly reject
 * a primitive schema like `z.string()`.
 */
export interface CreatableResource<T, C = T> extends ResourceConfig<T> {
  createFlags: Interfaces.FlagInput
  bodyBuilder: (flags: Record<string, unknown>) => object
  createRequestSchema: ZodType<object>
  /**
   * Optional response schema for the `create` endpoint when it differs
   * from the entity DTO returned by `list` / `get` (e.g. API key
   * `create` returns `ApiKeyCreateResponse` with the full secret value
   * rather than `ApiKeyDto`; incident `create` returns
   * `IncidentDetailDto` rather than `IncidentDto`). Defaults to
   * `responseSchema` for the common case where create echoes the entity.
   */
  createResponseSchema?: ZodType<C>
  /**
   * Optional post-create hook for side-effecting follow-ups that need
   * the freshly-created entity's id (alert-channel attachments,
   * assertions, etc.). Throw to abort — the hook is responsible for
   * any rollback (e.g. DELETE'ing the half-created entity) since the
   * factory has no idea which calls are safe to undo.
   */
  afterCreate?: (
    created: C,
    rawFlags: Record<string, unknown>,
    ctx: AfterHookContext,
  ) => Promise<void>
}

/**
 * Resources that expose an `update` command. Same semantics as
 * {@link CreatableResource}; `bodyBuilder` is reused when create and
 * update share the same field-mapping logic, and `updateBodyBuilder`
 * is the explicit override (used by NOTIFICATION_POLICIES, SECRETS).
 */
export interface UpdatableResource<T> extends ResourceConfig<T> {
  updateFlags?: Interfaces.FlagInput
  createFlags?: Interfaces.FlagInput
  bodyBuilder: (flags: Record<string, unknown>) => object
  updateBodyBuilder?: (flags: Record<string, unknown>) => object
  updateRequestSchema: ZodType<object>
  /** Optional post-update hook — see {@link CreatableResource.afterCreate}. */
  afterUpdate?: (
    updated: T,
    rawFlags: Record<string, unknown>,
    ctx: AfterHookContext & {id: string},
  ) => Promise<void>
}

/**
 * Context passed to `afterCreate` / `afterUpdate` hooks. The `command`
 * is the live oclif command instance, so hooks can use `command.log` /
 * `command.warn` for user-visible output without re-importing oclif.
 */
export interface AfterHookContext {
  client: ApiClient
  command: Command
  apiPath: string
}

/**
 * Pick "a" or "an" based on the next word's first sound. Used for the
 * autogenerated CRUD command descriptions (`Get a monitor by id`,
 * `Delete an alert channel`) so resource names that start with a vowel
 * read naturally. Heuristic on the first letter only — covers every
 * resource name we ship today without a full pronunciation table.
 */
export function aOrAn(word: string): 'a' | 'an' {
  const first = word.trim().charAt(0).toLowerCase()
  return 'aeiou'.includes(first) ? 'an' : 'a'
}

export function createListCommand<T>(config: ResourceConfig<T>) {
  class ListCmd extends Command {
    static description = `List all ${config.plural}`
    static examples = [`<%= config.bin %> ${config.plural} list`]
    static flags = {
      ...globalFlags,
      'page-size': Flags.integer({description: 'Number of items per API request (1–200)', default: 200}),
    }

    async run() {
      const {flags} = await this.parse(ListCmd)
      const client = buildClient(flags)
      const items = await fetchPaginatedValidated<T>(
        client,
        config.apiPath,
        config.responseSchema,
        flags['page-size'],
      )
      display(this, items, flags.output, config.columns)
    }
  }

  return ListCmd
}

function idArg(config: Pick<ResourceConfig<unknown>, 'name' | 'idField' | 'validateIdAsUuid'>): Arg<string> {
  const idLabel = config.idField ?? 'id'
  const useUuid = config.validateIdAsUuid ?? (idLabel === 'id' || idLabel === 'subscriptionId')
  if (useUuid) return uuidArg({description: `${config.name} ${idLabel}`, required: true})
  return Args.string({description: `${config.name} ${idLabel}`, required: true})
}

export function createGetCommand<T>(config: ResourceConfig<T>) {
  const idLabel = config.idField ?? 'id'
  const getResponseSchema = (config.getResponseSchema ?? config.responseSchema) as ZodType<unknown>
  class GetCmd extends Command {
    static description = `Get ${aOrAn(config.name)} ${config.name} by ${idLabel}`
    static examples = [`<%= config.bin %> ${config.plural} get <${idLabel}>`]
    static args = {[idLabel]: idArg(config)}
    static flags = {...globalFlags}

    async run() {
      const {args, flags} = await this.parse(GetCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      const path = `${config.apiPath}/${id}`
      const value = await apiGetSingle<unknown>(client, path, getResponseSchema)
      display(this, value, flags.output)
    }
  }

  return GetCmd
}

export function createCreateCommand<T, C = T>(config: CreatableResource<T, C>) {
  const resourceFlags = config.createFlags
  const createResponseSchema = (config.createResponseSchema ?? (config.responseSchema as unknown)) as ZodType<C>
  class CreateCmd extends Command {
    static description = `Create a new ${config.name}`
    static examples = [`<%= config.bin %> ${config.plural} create`]
    static flags = {...globalFlags, ...resourceFlags}

    async run() {
      const {flags} = await this.parse(CreateCmd)
      const client = buildClient(flags)
      const raw = extractResourceFlags(flags, Object.keys(resourceFlags))
      const built = config.bodyBuilder(raw)
      const body = parseSchema(config.createRequestSchema, built, `${config.name}.create body invalid`)
      const value = await apiPostSingle<C>(client, config.apiPath, createResponseSchema, body)
      if (config.afterCreate) {
        await config.afterCreate(value, raw, {client, command: this, apiPath: config.apiPath})
      }
      display(this, value, flags.output)
    }
  }

  return CreateCmd
}

export function createUpdateCommand<T>(config: UpdatableResource<T>) {
  const idLabel = config.idField ?? 'id'
  const resourceFlags = config.updateFlags ?? config.createFlags ?? {}
  const builder = config.updateBodyBuilder ?? config.bodyBuilder
  class UpdateCmd extends Command {
    static description = `Update ${aOrAn(config.name)} ${config.name}`
    static examples = [`<%= config.bin %> ${config.plural} update <${idLabel}>`]
    static args = {[idLabel]: idArg(config)}
    static flags = {...globalFlags, ...resourceFlags}

    async run() {
      const {args, flags} = await this.parse(UpdateCmd)
      const client = buildClient(flags)
      const id = args[idLabel] as string
      const raw = extractResourceFlags(flags, Object.keys(resourceFlags))
      const built = builder(raw)
      const body = parseSchema(config.updateRequestSchema, built, `${config.name}.update body invalid`)
      const path = `${config.apiPath}/${id}`
      const value = await apiPutSingle<T>(client, path, config.responseSchema, body)
      if (config.afterUpdate) {
        await config.afterUpdate(value, raw, {client, command: this, apiPath: config.apiPath, id})
      }
      display(this, value, flags.output)
    }
  }

  return UpdateCmd
}

export function createDeleteCommand<T>(config: ResourceConfig<T>) {
  const idLabel = config.idField ?? 'id'
  class DeleteCmd extends Command {
    static description = `Delete ${aOrAn(config.name)} ${config.name}`
    static examples = [
      `<%= config.bin %> ${config.plural} delete <${idLabel}>`,
      `<%= config.bin %> ${config.plural} delete <${idLabel}> --yes`,
    ]
    static args = {[idLabel]: idArg(config)}
    static flags = {
      ...globalFlags,
      yes: Flags.boolean({
        char: 'y',
        description: 'Skip the interactive confirmation prompt',
        default: false,
      }),
    }

    async run() {
      const {args, flags} = await this.parse(DeleteCmd)
      const client = buildClient(flags)
      // The id arg is declared `required: true` on the static args block
      // above, so oclif guarantees it's a string at runtime. The Record
      // index signature still types it as optional, hence the narrow.
      const id = args[idLabel] as string
      const path = `${config.apiPath}/${id}`

      if (!flags.yes) {
        if (!process.stdin.isTTY) {
          // In CI / piped invocations, prompting would hang and silent
          // auto-confirm would defeat the safety check. Refuse loudly.
          this.error(
            `Refusing to delete ${config.name} '${id}' in non-interactive mode without --yes (or -y).`,
            {exit: EXIT_CODES.VALIDATION},
          )
        }
        const confirmed = await promptForDeletion(config, id, path, client)
        if (!confirmed) {
          this.log('Cancelled.')
          return
        }
      }

      await apiDelete(client, path)
      this.log(`${config.name} '${id}' deleted.`)
    }
  }

  return DeleteCmd
}

/**
 * Best-effort label extractor used by the delete confirmation prompt so
 * the user sees `'My Monitor' (uuid)` instead of just the bare id. The
 * candidate keys cover the human-readable identifier on every CRUD
 * resource we ship: `name` for most, `slug`/`key` for status-page slugs
 * and secret keys, `summary`/`title` for incidents, `email` for users.
 * Returns `undefined` when nothing usable is found — the caller falls
 * back to the id alone, which is still safer than no prompt at all.
 */
export function extractEntityLabel(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of ['name', 'slug', 'key', 'title', 'summary', 'email']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

/**
 * Interactive confirmation prompt for the generated delete commands.
 *
 * GETs the resource first so the prompt can show its human-readable
 * name. A 404 (or 401/403) is surfaced before the destructive action:
 * the typo'd id never makes it to the prompt. Any other GET failure is
 * swallowed — we still prompt with the bare id rather than blocking the
 * user from a delete that would otherwise succeed.
 *
 * The non-TTY refusal is done by the caller (it has access to
 * `this.error()` for a clean oclif exit) so this helper only runs when
 * stdin is interactive.
 */
async function promptForDeletion<T>(
  config: ResourceConfig<T>,
  id: string,
  path: string,
  client: ApiClient,
): Promise<boolean> {
  let label = `'${id}'`
  try {
    const value = await apiGetSingle<unknown>(client, path, config.responseSchema as ZodType<unknown>)
    const name = extractEntityLabel(value)
    if (name) label = `'${name}' (${id})`
  } catch (err) {
    if (err instanceof DevhelmAuthError || err instanceof DevhelmNotFoundError) throw err
  }

  const {createInterface} = await import('node:readline')
  const rl = createInterface({input: process.stdin, output: process.stderr})
  const answer = await new Promise<string>((resolve) => {
    rl.question(`Delete ${config.name} ${label}? [y/N] `, resolve)
  })
  rl.close()
  const normalized = answer.trim().toLowerCase()
  return normalized === 'y' || normalized === 'yes'
}

function extractResourceFlags(flags: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const key of keys) {
    if (flags[key] !== undefined) {
      body[key] = flags[key]
    }
  }

  return body
}
