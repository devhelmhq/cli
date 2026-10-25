/** A FakeApi preloaded with the routes every project command reads, plus a temp project dir. */
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {computeDigestSync} from '@devhelm/sdk/bundler'
import {FakeApi} from './fake-api.js'
import {ENV_ID, cursor, page, run} from './monitor-fixtures.js'

export const ME = {
  key: {id: 7, name: 'ci', createdAt: '2026-10-01T00:00:00Z', expiresAt: null, lastUsedAt: null, scopes: ['full']},
  organization: {id: 1, name: 'acme-prod'},
  plan: {tier: 'STARTER', trialActive: false, entitlements: {}, usage: {}},
  rateLimits: {requestsPerMinute: 1000, remaining: 999, windowMs: 60000},
}

export const ENTITLEMENTS = {
  tier: 'STARTER', entitlements: {}, usage: {}, trialActive: false, usagePeriodStart: '2026-10-01T00:00:00Z',
}

export const ENVIRONMENT = {
  id: ENV_ID, orgId: 1, name: 'Production', slug: 'production', variables: {}, isDefault: true, monitorCount: 0,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
}

export const USAGE = {
  periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z',
  browser: {used: 10, included: 1000, testRuns: 2}, api: {used: 0, included: 5000, testRuns: 0}, monitors: [],
}

/** Install the shared routes; returns the api for chaining. */
export function projectRoutes(api: FakeApi, opts: {monitors?: unknown[]} = {}): FakeApi {
  api.on('GET', '/api/v1/auth/me', {body: {data: ME}})
  api.on('GET', '/api/v1/entitlements', {body: {data: ENTITLEMENTS}})
  api.on('GET', '/api/v1/workspaces', {body: page([{id: 1, name: 'prod', orgId: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z'}])})
  api.on('GET', '/api/v1/environments/production', {body: {data: ENVIRONMENT}})
  api.on('GET', '/api/v1/environments', {body: page([ENVIRONMENT])})
  api.on('GET', '/api/v1/synthetics/usage', {body: {data: USAGE}})
  api.on('GET', '/api/v1/synthetics/runtime-profiles', {body: page([])})
  api.on('GET', '/api/v1/monitors', {body: page(opts.monitors ?? [])})
  for (const p of ['tags', 'secrets', 'alert-channels', 'notification-policies', 'webhooks', 'resource-groups', 'service-subscriptions', 'status-pages']) {
    api.on('GET', `/api/v1/${p}`, {body: page([])})
  }
  api.on('POST', '/api/v1/bundles', (req) => {
    const body = req.json as {files: Record<string, string>}
    const files = Object.keys(body.files)
    return {status: 201, body: {data: {digest: computeDigestSync(body.files), uploadDigest: computeDigestSync(body.files), files, keys: [], size: 10}}}
  })
  api.on('POST', '/api/v1/bundles/check', {body: {data: {findings: []}}})
  api.on('GET', /^\/api\/v1\/runs\/[^/]+\/events$/, {raw: ''})
  api.on('POST', '/api/v1/deploy/lock', {status: 201, body: {data: {id: '99999999-9999-4999-8999-999999999999', lockedBy: 'ci', lockedAt: '2026-10-25T00:00:00Z', expiresAt: '2026-10-25T01:00:00Z'}}})
  api.on('DELETE', /^\/api\/v1\/deploy\/lock\/.+$/, {status: 204})
  api.on('POST', '/api/v1/monitors/validate', {body: {data: {findings: [], projections: []}}})
  return api
}

export {cursor, page, run}

export function tempProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'devhelm-project-'))
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path)
    mkdirSync(dirname(abs), {recursive: true})
    writeFileSync(abs, content)
  }
  mkdirSync(join(dir, '.git'))
  return dir
}

export const BROWSER_SPEC = `import {test, expect} from '@playwright/test'

test('checkout', async ({page}) => {
  await page.goto(process.env.BASE_URL ?? 'https://example.com')
  await expect(page).toHaveTitle(/Example/)
})
`

export const PROJECT_YAML = `project: acme/web
monitors:
  - name: Checkout
    type: BROWSER
    environment: production
    code: synthetics/checkout.spec.ts
    frequencySeconds: 600
    regions: [us-east]
  - name: Homepage
    type: HTTP
    config: {url: https://example.com, method: GET}
`
