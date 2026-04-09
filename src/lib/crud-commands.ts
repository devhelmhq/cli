import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from './base-command.js'
import {ColumnDef} from './output.js'
import {TableResponse, SingleResponse} from './api-client.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFlag = any

export interface ResourceConfig {
  name: string
  plural: string
  apiPath: string
  idField?: string
  columns: ColumnDef[]
  createFlags?: Record<string, AnyFlag>
  updateFlags?: Record<string, AnyFlag>
}

export function createListCommand(config: ResourceConfig) {
  class ListCmd extends Command {
    static description = `List all ${config.plural}`
    static examples = [`<%= config.bin %> ${config.plural} list`]
    static flags = {...globalFlags}

    async run() {
      const {flags} = await this.parse(ListCmd)
      const client = buildClient(flags)
      const resp = await client.get<TableResponse<Record<string, unknown>>>(config.apiPath)
      display(this, resp.content, flags.output, config.columns)
    }
  }

  return ListCmd
}

export function createGetCommand(config: ResourceConfig) {
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
      const resp = await client.get<SingleResponse<Record<string, unknown>>>(`${config.apiPath}/${id}`)
      display(this, resp.content, flags.output)
    }
  }

  return GetCmd
}

export function createCreateCommand(config: ResourceConfig) {
  const resourceFlags = config.createFlags ?? {}
  class CreateCmd extends Command {
    static description = `Create a new ${config.name}`
    static examples = [`<%= config.bin %> ${config.plural} create`]
    static flags = {...globalFlags, ...resourceFlags}

    async run() {
      const {flags} = await this.parse(CreateCmd)
      const client = buildClient(flags)
      const body = extractResourceFlags(flags, Object.keys(resourceFlags))
      const resp = await client.post<SingleResponse<Record<string, unknown>>>(config.apiPath, body)
      display(this, resp.content, flags.output)
    }
  }

  return CreateCmd
}

export function createUpdateCommand(config: ResourceConfig) {
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
      const body = extractResourceFlags(flags, Object.keys(resourceFlags))
      const resp = await client.put<SingleResponse<Record<string, unknown>>>(`${config.apiPath}/${id}`, body)
      display(this, resp.content, flags.output)
    }
  }

  return UpdateCmd
}

export function createDeleteCommand(config: ResourceConfig) {
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
      await client.delete(`${config.apiPath}/${id}`)
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
