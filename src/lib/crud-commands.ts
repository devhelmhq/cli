import {Command, Args, Flags, type Interfaces} from '@oclif/core'
import {globalFlags, buildClient, display} from './base-command.js'
import {fetchPaginated} from './typed-api.js'
import {apiGet, apiPost, apiPut, apiDelete} from './api-client.js'
import type {ColumnDef} from './output.js'
import {uuidArg} from './validators.js'

type Arg<T> = Interfaces.Arg<T>

export interface ResourceConfig<T = unknown> {
  name: string
  plural: string
  apiPath: string
  /** Field name used as the resource identifier (default: 'id'). */
  idField?: string
  /** Set to false to skip UUID validation on the id arg (e.g. for slug/key ids). */
  validateIdAsUuid?: boolean
  columns: ColumnDef<T>[]
  createFlags?: Interfaces.FlagInput
  updateFlags?: Interfaces.FlagInput
  bodyBuilder?: (flags: Record<string, unknown>) => object
  updateBodyBuilder?: (flags: Record<string, unknown>) => object
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
      const items = await fetchPaginated<T>(client, config.apiPath, flags['page-size'])
      display(this, items, flags.output, config.columns)
    }
  }

  return ListCmd
}

function idArg(config: Pick<ResourceConfig, 'name' | 'idField' | 'validateIdAsUuid'>): Arg<string> {
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
      const resp = (await apiGet(client, `${config.apiPath}/${id}`)) as {data?: T}
      display(this, resp.data ?? resp, flags.output)
    }
  }

  return GetCmd
}

export function createCreateCommand<T>(config: ResourceConfig<T>) {
  const resourceFlags = config.createFlags ?? {}
  class CreateCmd extends Command {
    static description = `Create a new ${config.name}`
    static examples = [`<%= config.bin %> ${config.plural} create`]
    static flags = {...globalFlags, ...resourceFlags}

    async run() {
      const {flags} = await this.parse(CreateCmd)
      const client = buildClient(flags)
      const raw = extractResourceFlags(flags, Object.keys(resourceFlags))
      const body = config.bodyBuilder ? config.bodyBuilder(raw) : raw
      const resp = (await apiPost(client, config.apiPath, body)) as {data?: T}
      display(this, resp.data ?? resp, flags.output)
    }
  }

  return CreateCmd
}

export function createUpdateCommand<T>(config: ResourceConfig<T>) {
  const idLabel = config.idField ?? 'id'
  const resourceFlags = config.updateFlags ?? config.createFlags ?? {}
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
      const builder = config.updateBodyBuilder ?? config.bodyBuilder
      const body = builder ? builder(raw) : raw
      const resp = (await apiPut(client, `${config.apiPath}/${id}`, body)) as {data?: T}
      display(this, resp.data ?? resp, flags.output)
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
