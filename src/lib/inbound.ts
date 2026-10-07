import {mkdir, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {createInterface} from 'node:readline'
import {stat} from 'node:fs/promises'
import {Command} from '@oclif/core'
import {apiDelete, apiGet, apiPatch, apiPost, checkedFetch, unwrapData, type ApiClient} from './api-client.js'
import {display} from './base-command.js'
import {DevhelmApiError, DevhelmTransportError, DevhelmValidationError, EXIT_CODES} from './errors.js'
import type {ColumnDef} from './output.js'

const WAIT_SLACK_MS = 10_000

const cell = (row: Record<string, unknown>, key: string): string => String(row[key] ?? '')

export const INBOX_COLUMNS: ColumnDef[] = [
  {header: 'ID', get: (row: Record<string, unknown>) => cell(row, 'id')},
  {header: 'NAME', get: (row: Record<string, unknown>) => cell(row, 'name')},
  {header: 'STATUS', get: (row: Record<string, unknown>) => cell(row, 'status')},
  {header: 'URL', get: (row: Record<string, unknown>) => cell(row, 'httpUrl')},
]

export const EVENT_COLUMNS: ColumnDef[] = [
  {header: 'ID', get: (row: Record<string, unknown>) => cell(row, 'id')},
  {header: 'METHOD', get: (row: Record<string, unknown>) => cell(row, 'method')},
  {header: 'PATH', get: (row: Record<string, unknown>) => cell(row, 'path')},
  {header: 'RECEIVED', get: (row: Record<string, unknown>) => cell(row, 'receivedAt')},
]

export const MESSAGE_COLUMNS: ColumnDef[] = [
  {header: 'ID', get: (row: Record<string, unknown>) => cell(row, 'id')},
  {header: 'FROM', get: (row: Record<string, unknown>) => cell(row, 'from')},
  {header: 'SUBJECT', get: (row: Record<string, unknown>) => cell(row, 'subject')},
  {header: 'OTP', get: (row: Record<string, unknown>) => otpColumn(row)},
  {header: 'RECEIVED', get: (row: Record<string, unknown>) => cell(row, 'receivedAt')},
]

export const DOMAIN_COLUMNS: ColumnDef[] = [
  {header: 'NAME', get: (row: Record<string, unknown>) => cell(row, 'name')},
  {header: 'KIND', get: (row: Record<string, unknown>) => cell(row, 'kind')},
  {header: 'STATUS', get: (row: Record<string, unknown>) => cell(row, 'status')},
  {header: 'MX', get: (row: Record<string, unknown>) => cell(row, 'mxVerified')},
]

export function otpColumn(row: Record<string, unknown>): string {
  const otp = row.otp
  if (!Array.isArray(otp)) return ''
  return otp
    .map((item: unknown) => {
      if (!item || typeof item !== 'object' || !('value' in item)) return ''
      const value = (item as {value?: unknown}).value
      return value == null ? '' : String(value)
    })
    .filter((value) => value.length > 0)
    .join(', ')
}

export function splitAddress(address: string): {localPart: string; domain: string} {
  const at = address.lastIndexOf('@')
  if (at <= 0 || at === address.length - 1) {
    throw new DevhelmValidationError(`Expected a full address, got '${address}'.`)
  }
  return {localPart: address.slice(0, at), domain: address.slice(at + 1)}
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DevhelmValidationError('Expected a JSON object from the API.')
  }
  return value as Record<string, unknown>
}

export function unwrapKey(value: unknown, key: string): Record<string, unknown> {
  const record = asRecord(value)
  if (!(key in record)) {
    throw new DevhelmValidationError(`Expected a ${key} in the response.`)
  }
  return asRecord(record[key])
}

export async function postWait(
  client: ApiClient,
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const signal = AbortSignal.timeout(timeoutMs + WAIT_SLACK_MS)
  return checkedFetch(client.POST(path as never, {body, signal} as never))
}

export async function waitOrExplain(
  command: Command,
  label: string,
  run: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await run()
  } catch (err) {
    if (err instanceof DevhelmApiError && err.status === 408) {
      command.error(`${err.message} (${label})`, {exit: EXIT_CODES.API})
    }
    throw err
  }
}

export async function requireYes(command: Command, yes: boolean, prompt: string): Promise<void> {
  if (yes) return
  if (!process.stdin.isTTY) {
    command.error(`Refusing to continue without --yes. ${prompt}`, {exit: EXIT_CODES.VALIDATION})
  }
  const rl = createInterface({input: process.stdin, output: process.stderr})
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${prompt} [y/N] `, resolve)
  })
  rl.close()
  if (answer.trim().toLowerCase() !== 'y') {
    command.error('Aborted.', {exit: EXIT_CODES.GENERAL})
  }
}

export function show(command: Command, data: unknown, format: string, columns?: ColumnDef[]): void {
  display(command, data, format, columns)
}

export async function listTable(
  client: ApiClient,
  path: string,
  params?: object,
): Promise<Record<string, unknown>[]> {
  const body = asRecord(await apiGet(client, path, params))
  const data = body.data
  if (!Array.isArray(data)) return []
  return data.map((item) => asRecord(item))
}

export async function downloadToFile(
  client: ApiClient,
  path: string,
  file: string,
): Promise<{url: string; expiresAt: string; file: string; filename: string}> {
  const signed = asRecord(unwrapData(await apiGet(client, path)))
  const url = String(signed.url ?? '')
  const filename = String(signed.filename ?? 'download')
  if (!url) throw new DevhelmValidationError('Signed download did not include a url.')
  let response: Response
  try {
    response = await fetch(url)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new DevhelmTransportError(message, {cause})
  }
  if (!response.ok) {
    throw new DevhelmTransportError(`Download failed with status ${response.status}`)
  }
  const target = await resolveDownloadPath(file, filename)
  await mkdir(dirname(target), {recursive: true})
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
  return {
    url,
    expiresAt: String(signed.expiresAt ?? ''),
    file: target,
    filename,
  }
}

async function resolveDownloadPath(file: string, filename: string): Promise<string> {
  try {
    const info = await stat(file)
    if (info.isDirectory()) return join(file, filename)
  } catch {
    if (!file.includes('.')) return join(file, filename)
  }
  return file
}

export async function deletePath(client: ApiClient, path: string): Promise<void> {
  await apiDelete(client, path)
}

export async function patchRecord(client: ApiClient, path: string, body: object): Promise<Record<string, unknown>> {
  return asRecord(unwrapData(await apiPatch(client, path, body)))
}

export async function postRecord(client: ApiClient, path: string, body?: object): Promise<Record<string, unknown>> {
  return asRecord(unwrapData(await apiPost(client, path, body)))
}

export function responseHeaderMap(values: string | string[] | undefined): Record<string, string> | undefined {
  if (values == null) return undefined
  const list = Array.isArray(values) ? values : [values]
  if (list.length === 0) return undefined
  const headers: Record<string, string> = {}
  for (const raw of list) {
    const colon = raw.indexOf(':')
    const name = colon < 0 ? '' : raw.slice(0, colon).trim()
    if (colon < 0 || name.length === 0) {
      throw new DevhelmValidationError(`Expected a header as Name: value, got '${raw}'.`)
    }
    if (Object.hasOwn(headers, name)) {
      throw new DevhelmValidationError(`Header '${name}' was given twice.`)
    }
    headers[name] = raw.slice(colon + 1).trim()
  }
  return headers
}

export function mockReply(flags: {
  'response-status'?: number
  'response-body'?: string
  'response-content-type'?: string
  'response-delay-ms'?: number
  'response-header'?: string | string[]
}): Record<string, unknown> | undefined {
  const httpResponse: Record<string, unknown> = {}
  if (flags['response-status'] !== undefined) httpResponse.status = flags['response-status']
  if (flags['response-body'] !== undefined) httpResponse.body = flags['response-body']
  if (flags['response-content-type'] !== undefined) httpResponse.contentType = flags['response-content-type']
  if (flags['response-delay-ms'] !== undefined) httpResponse.delayMs = flags['response-delay-ms']
  const headers = responseHeaderMap(flags['response-header'])
  if (headers) httpResponse.headers = headers
  return Object.keys(httpResponse).length > 0 ? httpResponse : undefined
}

export function bucketTotal(row: Record<string, unknown>, countKey: string): string {
  const buckets = row.buckets
  if (!Array.isArray(buckets)) return '0'
  let total = 0
  for (const item of buckets) {
    if (!item || typeof item !== 'object') continue
    const count = (item as Record<string, unknown>)[countKey]
    if (typeof count === 'number') total += count
  }
  return String(total)
}

export function dnsLines(domain: Record<string, unknown>): string {
  const records = domain.dnsRecords
  if (!Array.isArray(records) || records.length === 0) return 'No DNS records.'
  return records
    .map((item) => {
      const record = asRecord(item)
      const priority = record.priority == null ? '' : ` ${record.priority}`
      return `${record.type} ${record.name} ${record.value}${priority}`
    })
    .join('\n')
}
