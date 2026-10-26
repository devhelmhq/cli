import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {ENV_ID, ENVIRONMENT, MONITOR, runCliInput} from '../helpers/other-fixtures.js'

const SECRET = {id: '55555555-5555-5555-5555-555555555555', key: 'CARD_TOKEN', dekVersion: 1, valueHash: 'h', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z'}

describe('secrets commands', () => {
  let api: FakeApi
  beforeAll(async () => {
    api = await new FakeApi().start()
    api.on('GET', '/api/v1/environments/staging', {body: {data: ENVIRONMENT}})
    api.on('PUT', `/api/v1/secrets/CARD_TOKEN/environments/${ENV_ID}`, {status: 204})
    api.on('DELETE', `/api/v1/secrets/CARD_TOKEN/environments/${ENV_ID}`, {status: 204})
    api.on('POST', '/api/v1/secrets', {status: 201, body: {data: SECRET}})
    api.on('PUT', '/api/v1/secrets/CARD_TOKEN', {body: {data: SECRET}})
    api.on('GET', '/api/v1/secrets', {body: {data: [SECRET], hasNext: false, hasPrev: false}})
  })
  afterAll(() => api.stop())
  afterEach(() => {
    api.captured = []
  })

  test('values set --from-env → PUT the env value; nothing on argv', async () => {
    const r = await runCli(['secrets', 'values', 'set', 'CARD_TOKEN', '--env', 'staging', '--from-env', 'MY_VAR', '-o', 'json'], {api, env: {MY_VAR: 's3cr3t'}})
    expect(r.code).toBe(0)
    const put = api.calls('PUT', `/api/v1/secrets/CARD_TOKEN/environments/${ENV_ID}`)
    expect(put[0]!.json).toEqual({value: 's3cr3t'})
    expect(r.stdout).not.toContain('s3cr3t')
  }, 60_000)

  test('values set --value-stdin reads stdin', async () => {
    const r = await runCliInput(['secrets', 'values', 'set', 'CARD_TOKEN', '--env', 'staging', '--value-stdin', '-o', 'json'], 'piped\n', {api})
    expect(r.code).toBe(0)
    expect(api.calls('PUT', `/api/v1/secrets/CARD_TOKEN/environments/${ENV_ID}`)[0]!.json).toEqual({value: 'piped'})
  }, 60_000)

  test('values set without a value source → exit 4 with the fix command', async () => {
    const r = await runCli(['secrets', 'values', 'set', 'CARD_TOKEN', '--env', 'staging', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    expect((r.json as {error: {next: {command: string}}}).error.next.command).toContain('--value-stdin')
  }, 60_000)

  test('values set has no value argument / flag', async () => {
    const r = await runCli(['secrets', 'values', 'set', 'CARD_TOKEN', 'oops', '--env', 'staging'], {api})
    expect(r.code).toBe(2)
  }, 60_000)

  test('values delete deletes the environment value', async () => {
    expect((await runCli(['secrets', 'values', 'delete', 'CARD_TOKEN', '--env', 'staging', '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('DELETE', `/api/v1/secrets/CARD_TOKEN/environments/${ENV_ID}`)).toHaveLength(1)
  }, 60_000)

  test('delete is refused while in use (exit 18, monitors listed)', async () => {
    api.on('GET', '/api/v1/secrets/CARD_TOKEN/usage', {body: {data: {monitors: [MONITOR]}}})
    const r = await runCli(['secrets', 'delete', 'CARD_TOKEN', '--yes'], {api})
    expect(r.code).toBe(18)
    expect(r.stderr).toContain('SECRET_IN_USE')
    expect(r.stderr).toContain('Checkout')
    expect(api.calls('DELETE', '/api/v1/secrets/CARD_TOKEN')).toHaveLength(0)
  }, 60_000)

  test('delete of an unused secret with --yes', async () => {
    api.on('GET', '/api/v1/secrets/CARD_TOKEN/usage', {body: {data: {monitors: []}}})
    api.on('DELETE', '/api/v1/secrets/CARD_TOKEN', {status: 204})
    const r = await runCli(['secrets', 'delete', 'CARD_TOKEN', '--yes'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('deleted')
  }, 60_000)

  test('legacy create --key --value still works (bare JSON, deprecation warning)', async () => {
    const r = await runCli(['secrets', 'create', '--key', 'CARD_TOKEN', '--value', 'v', '--output', 'json'], {api})
    expect(r.code).toBe(0)
    expect((r.json as {key: string}).key).toBe('CARD_TOKEN')
    expect(r.stderr).toContain('2027-01-31')
    expect(api.calls('POST', '/api/v1/secrets')[0]!.json).toEqual({key: 'CARD_TOKEN', value: 'v'})
  }, 60_000)

  test('create <KEY> --env --from-env sends the environment', async () => {
    const r = await runCli(['secrets', 'create', 'CARD_TOKEN', '--env', 'staging', '--from-env', 'X', '--output', 'json'], {api, env: {X: 'abc'}})
    expect(r.code).toBe(0)
    expect(api.calls('POST', '/api/v1/secrets')[0]!.json).toEqual({key: 'CARD_TOKEN', value: 'abc', environmentId: ENV_ID})
  }, 60_000)

  test('legacy update KEY --value still works', async () => {
    const r = await runCli(['secrets', 'update', 'CARD_TOKEN', '--value', 'v2', '--output', 'json'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('PUT', '/api/v1/secrets/CARD_TOKEN')[0]!.json).toEqual({value: 'v2'})
  }, 60_000)

  test('list is a bare list in legacy JSON; --env filters by id', async () => {
    const r = await runCli(['secrets', 'list', '--output', 'json', '--env', 'staging'], {api})
    expect(Array.isArray(r.json)).toBe(true)
    expect(api.calls('GET', '/api/v1/secrets')[0]!.query.get('environmentId')).toBe(ENV_ID)
  }, 60_000)

  test('usage lists monitors', async () => {
    api.on('GET', '/api/v1/secrets/CARD_TOKEN/usage', {body: {data: {monitors: [MONITOR]}}})
    const r = await runCli(['secrets', 'usage', 'CARD_TOKEN', '-o', 'table'], {api})
    expect(r.stdout).toContain('Checkout')
  }, 60_000)
})
