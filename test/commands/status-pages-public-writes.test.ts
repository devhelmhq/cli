import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {PAGE_ID} from '../helpers/other-fixtures.js'

const SPI = '66666666-6666-6666-6666-666666666666'
const base = ['status-pages', 'incidents', 'create', PAGE_ID, '--title', 'Checkout errors', '--impact', 'MAJOR', '--body', 'Investigating']

describe('status-page public write gate', () => {
  let api: FakeApi
  beforeAll(async () => {
    api = await new FakeApi().start()
    api.on('POST', `/api/v1/status-pages/${PAGE_ID}/incidents`, {status: 201, body: {data: {id: SPI, title: 'Checkout errors'}}})
    api.on('POST', `/api/v1/status-pages/${PAGE_ID}/incidents/${SPI}/updates`, {status: 201, body: {data: {id: SPI}}})
    api.on('POST', `/api/v1/status-pages/${PAGE_ID}/maintenance/${SPI}/publish`, {body: {data: {id: SPI}}})
  })
  afterAll(() => api.stop())
  afterEach(() => {
    api.captured = []
  })

  test('no notify decision without a TTY → exit 4', async () => {
    const r = await runCli(base, {api})
    expect(r.code).toBe(4)
    expect(r.stderr).toContain('NOTIFY_DECISION_REQUIRED')
    expect(api.calls('POST', `/api/v1/status-pages/${PAGE_ID}/incidents`)).toHaveLength(0)
  }, 60_000)

  test('--yes does not confirm a public write → exit 15 with a token', async () => {
    const r = await runCli([...base, '--no-notify-subscribers', '--yes', '-o', 'json'], {api, env: {DEVHELM_JSON_ENVELOPE: '1'}})
    expect(r.code).toBe(15)
    const doc = r.json as {confirmCommand: string; changes: Array<{notifySubscribers: boolean}>}
    expect(doc.confirmCommand).toMatch(/--confirm cft_[0-9a-f]{20}$/)
    expect(doc.confirmCommand).not.toContain('--yes')
    expect(doc.confirmCommand).not.toContain('dh_live_test')
    expect(doc.changes[0]!.notifySubscribers).toBe(false)
    expect(api.calls('POST', `/api/v1/status-pages/${PAGE_ID}/incidents`)).toHaveLength(0)
  }, 60_000)

  test('the printed token confirms exactly this text; another text is refused', async () => {
    const first = await runCli([...base, '--no-notify-subscribers', '-o', 'json'], {api, env: {DEVHELM_JSON_ENVELOPE: '1'}})
    const token = /--confirm (cft_[0-9a-f]+)/.exec((first.json as {confirmCommand: string}).confirmCommand)![1]!
    const ok = await runCli([...base, '--no-notify-subscribers', '--confirm', token, '--output', 'json'], {api})
    expect(ok.code).toBe(0)
    expect(api.calls('POST', `/api/v1/status-pages/${PAGE_ID}/incidents`)[0]!.json).toEqual({title: 'Checkout errors', impact: 'MAJOR', body: 'Investigating', notifySubscribers: false})
    const changed = await runCli([...base.slice(0, -1), 'Investigating!', '--no-notify-subscribers', '--confirm', token], {api})
    expect(changed.code).toBe(4)
    const notify = await runCli([...base, '--notify-subscribers', '--confirm', token], {api})
    expect(notify.code).toBe(4)
  }, 60_000)

  test('post-update and maintenance publish are gated too', async () => {
    const pu = await runCli(['status-pages', 'incidents', 'post-update', PAGE_ID, SPI, '--body', 'Fixed', '--status', 'MONITORING', '--notify-subscribers'], {api})
    expect(pu.code).toBe(15)
    const mp = await runCli(['status-pages', 'maintenance', 'publish', PAGE_ID, SPI], {api})
    expect(mp.code).toBe(4)
  }, 60_000)

  test('missing required flags still name the flag (exit 2)', async () => {
    const r = await runCli(['status-pages', 'incidents', 'create', PAGE_ID, '--impact', 'MINOR', '--body', 'd'], {api})
    expect(r.code).toBe(2)
    expect(r.stderr.toLowerCase()).toContain('title')
  }, 60_000)
})
