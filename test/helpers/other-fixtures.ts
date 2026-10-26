import {spawn} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {repoRoot, type CliResult, type FakeApi} from './fake-api.js'

const QUEUED_RUN = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  organizationId: 1,
  monitorId: '11111111-1111-4111-8111-111111111111',
  monitorName: 'Checkout',
  monitorType: 'BROWSER',
  revisionId: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  region: 'us-east',
  source: 'remote_validation',
  countsTowardHealth: false,
  enqueuedAt: '2026-10-21T10:00:00Z',
  phase: 'queued',
  cancelRequested: false,
  bundleDigest: 'sha256:abc',
  capturePolicySnapshot: {},
  bindingVersionSnapshot: {},
  stream: false,
  evidence: [],
  tabCounts: {steps: 0, assets: 0, diff: 0},
  attempt: 1,
  attemptOf: 1,
  attempts: [],
  executionAttempts: [],
  flaky: false,
  billable: true,
}

export const RUN_ID = QUEUED_RUN.id
export const MONITOR_ID = '11111111-1111-4111-8111-111111111111'
export const ENV_ID = '22222222-2222-2222-2222-222222222222'
export const PAGE_ID = '33333333-3333-3333-3333-333333333333'
export const INCIDENT_ID = '44444444-4444-4444-4444-444444444444'

export function run(overrides: Record<string, unknown> = {}) {
  return {...QUEUED_RUN, phase: 'finished', outcome: 'passed', url: `https://app.devhelm.io/runs/${QUEUED_RUN.id}`, ...overrides}
}

export const MONITOR = {
  id: MONITOR_ID, organizationId: 1, name: 'Checkout', type: 'BROWSER', config: {}, frequencySeconds: 600, enabled: true,
  regions: ['us-east'], managedBy: 'CLI', ownerEnforced: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  muted: false, environment: {id: ENV_ID, name: 'Staging', slug: 'staging'},
}

export const ENVIRONMENT = {
  id: ENV_ID, orgId: 1, name: 'Staging', slug: 'staging', variables: {}, createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z', monitorCount: 1, isDefault: false,
}

export function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), 'devhelm-home-'))
}

/** runCli with stdin input. */
export function runCliInput(args: string[], input: string, opts: {api?: FakeApi; env?: Record<string, string>} = {}): Promise<CliResult> {
  const base = opts.api ? ['--api-url', opts.api.url, '--api-token', 'dh_live_test'] : []
  return new Promise((resolve) => {
    const child = spawn('node', [join(repoRoot, 'bin/dev.js'), ...args, ...base], {
      cwd: repoRoot,
      env: {...process.env, DEVHELM_TELEMETRY: '0', DEVHELM_RETRY_MAX_DELAY_MS: '1', DEVHELM_API_TOKEN: '', HOME: tmpHome(), CI: '', GITHUB_RUN_ID: '', ...opts.env},
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', (code) => {
      let json: unknown
      try { json = JSON.parse(stdout) } catch { json = undefined }
      resolve({code: code ?? 1, stdout, stderr, json})
    })
    child.stdin.end(input)
  })
}
