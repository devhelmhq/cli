import {Command, Args, Flags, type Interfaces} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient, display} from './base-command.js'
import {fetchPaginatedValidated} from './typed-api.js'
import {apiDelete, apiGetSingle, apiPostSingle, apiPutSingle} from './api-client.js'
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
export interface CreatableResource<T> extends ResourceConfig<T> {
  createFlags: Interfaces.FlagInput
  bodyBuilder: (flags: Record<string, unknown>) => object
  createRequestSchema: ZodType<object>
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
  class GetCmd extends Command {
    static description = `Get a ${config.name} by ${idLabel}`
    static examples = [`<%= config.bin %> ${config.plural} get <${idLabel}>`]
    static args = {[idLabel]: idArg(config)}
    static flags = {...globalFlags}

    async run() {
      const {args, flags} = await this.parse(GetCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      const path = `${config.apiPath}/${id}`
      const value = await apiGetSingle<T>(client, path, config.responseSchema)
      display(this, value, flags.output)
    }
  }

  return GetCmd
}

export function createCreateCommand<T>(config: CreatableResource<T>) {
  const resourceFlags = config.createFlags
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
      const value = await apiPostSingle<T>(client, config.apiPath, config.responseSchema, body)
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
    static description = `Update a ${config.name}`
    static examples = [`<%= config.bin %> ${config.plural} update <${idLabel}>`]
    static args = {[idLabel]: idArg(config)}
    static flags = {...globalFlags, ...resourceFlags}

    async run() {
      const {args, flags} = await this.parse(UpdateCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      const raw = extractResourceFlags(flags, Object.keys(resourceFlags))
      const built = builder(raw)
      const body = parseSchema(config.updateRequestSchema, built, `${config.name}.update body invalid`)
      const path = `${config.apiPath}/${id}`
      const value = await apiPutSingle<T>(client, path, config.responseSchema, body)
      display(this, value, flags.output)
    }
  }

  return UpdateCmd
}

export function createDeleteCommand<T>(config: ResourceConfig<T>) {
  const idLabel = config.idField ?? 'id'
  class DeleteCmd extends Command {
    static description = `Delete a ${config.name}`
    static examples = [`<%= config.bin %> ${config.plural} delete <${idLabel}>`]
    static args = {[idLabel]: idArg(config)}
    static flags = {...globalFlags}

    async run() {
      const {args, flags} = await this.parse(DeleteCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      await apiDelete(client, `${config.apiPath}/${id}`)
      this.log(`${config.name} '${id}' deleted.`)
    }
  }

  return DeleteCmd
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
