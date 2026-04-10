import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from './base-command.js'
import {typedGet, typedPost, typedPut, typedDelete} from './typed-api.js'
import type {ColumnDef} from './output.js'

// oclif flag types are structurally complex; this alias keeps ResourceConfig readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OclifFlag = any

export interface ResourceConfig<T = unknown> {
  name: string
  plural: string
  apiPath: string
  idField?: string
  columns: ColumnDef<T>[]
  createFlags?: Record<string, OclifFlag>
  updateFlags?: Record<string, OclifFlag>
  bodyBuilder?: (flags: Record<string, unknown>) => object
}

interface PaginatedResponse<T> {
  data?: T[]
  hasNext?: boolean
}

export function createListCommand<T>(config: ResourceConfig<T>) {
  class ListCmd extends Command {
    static description = `List all ${config.plural}`
    static examples = [`<%= config.bin %> ${config.plural} list`]
    static flags = {...globalFlags}

    async run() {
      const {flags} = await this.parse(ListCmd)
      const client = buildClient(flags)
      const resp = await typedGet<PaginatedResponse<T>>(client, config.apiPath)
      display(this, resp.data ?? [], flags.output, config.columns)
    }
  }

  return ListCmd
}

export function createGetCommand<T>(config: ResourceConfig<T>) {
  const idLabel = config.idField ?? 'id'
  class GetCmd extends Command {
    static description = `Get a ${config.name} by ${idLabel}`
    static examples = [`<%= config.bin %> ${config.plural} get <${idLabel}>`]
    static args = {[idLabel]: Args.string({description: `${config.name} ${idLabel}`, required: true})}
    static flags = {...globalFlags}

    async run() {
      const {args, flags} = await this.parse(GetCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      const resp = await typedGet<{data?: T}>(client, `${config.apiPath}/${id}`)
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
      const resp = await typedPost<{data?: T}>(client, config.apiPath, body)
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
    static args = {[idLabel]: Args.string({description: `${config.name} ${idLabel}`, required: true})}
    static flags = {...globalFlags, ...resourceFlags}

    async run() {
      const {args, flags} = await this.parse(UpdateCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      const raw = extractResourceFlags(flags, Object.keys(resourceFlags))
      const body = config.bodyBuilder ? config.bodyBuilder(raw) : raw
      const resp = await typedPut<{data?: T}>(client, `${config.apiPath}/${id}`, body)
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
    static args = {[idLabel]: Args.string({description: `${config.name} ${idLabel}`, required: true})}
    static flags = {...globalFlags}

    async run() {
      const {args, flags} = await this.parse(DeleteCmd)
      const client = buildClient(flags)
      const id = args[idLabel]
      await typedDelete(client, `${config.apiPath}/${id}`)
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
