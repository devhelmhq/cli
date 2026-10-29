/** Wire fixtures for monitor command tests (shapes accepted by the generated schemas). */
export const MID = '11111111-1111-4111-8111-111111111111'
export const MID2 = '22222222-2222-4222-8222-222222222222'
export const ENV_ID = '33333333-3333-4333-8333-333333333333'
export const RUN_ID = '44444444-4444-4444-8444-444444444444'
export const RV_ID = '55555555-5555-4555-8555-555555555555'
export const RV_LIVE = '66666666-6666-4666-8666-666666666666'
export const DEF_ID = '77777777-7777-4777-8777-777777777777'

export function monitor(over: Record<string, unknown> = {}): Record<string, unknown> {
  const type = (over.type as string | undefined) ?? 'HTTP'
  const code = type === 'BROWSER' || type === 'MULTI_STEP_API'
  return {
    id: MID,
    organizationId: 1,
    name: 'Checkout',
    type,
    config: code ? {timeoutSeconds: 90} : type === 'HEARTBEAT' ? {expectedInterval: 60, gracePeriod: 60} : {url: 'https://example.com', method: 'GET'},
    frequencySeconds: 600,
    enabled: true,
    regions: ['us-east', 'eu-west'],
    managedBy: 'DASHBOARD',
    ownerEnforced: false,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    muted: false,
    environment: {id: ENV_ID, name: 'Production', slug: 'production'},
    ...(code ? {liveRevisionId: RV_LIVE, liveRevisionDigest: 'sha256:' + 'a'.repeat(64), definitionId: DEF_ID} : {}),
    ...over,
  }
}

export function run(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RUN_ID,
    organizationId: 1,
    monitorId: MID,
    revisionId: RV_ID,
    region: 'us-east',
    source: 'remote_validation',
    countsTowardHealth: false,
    enqueuedAt: '2026-10-21T10:00:00Z',
    phase: 'queued',
    cancelRequested: false,
    bundleDigest: 'sha256:abc',
    capturePolicySnapshot: {},
    bindingVersionSnapshot: {keys: [], attachedKeys: []},
    stream: false,
    evidence: [],
    tabCounts: {steps: 0, assets: 0, diff: 0},
    attempt: 1,
    attemptOf: 1,
    attempts: [],
    executionAttempts: [],
    flaky: false,
    billable: true,
    url: `https://app.devhelm.io/runs/${RUN_ID}`,
    ...over,
  }
}

export function revision(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RV_ID,
    definitionId: DEF_ID,
    number: 3,
    digest: 'sha256:' + 'b'.repeat(64),
    entrypoint: 'checkout.spec.ts',
    files: ['checkout.spec.ts'],
    keys: [],
    createdAt: '2026-10-21T10:00:00Z',
    state: 'draft',
    createdByKind: 'git',
    ...over,
  }
}

export function head(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    definitionId: DEF_ID,
    environment: {id: ENV_ID, name: 'Production', slug: 'production', variables: {}, isDefault: true, monitorCount: 1, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', orgId: 1},
    revision: revision({state: 'live'}),
    activatedAt: '2026-10-21T10:00:00Z',
    ...over,
  }
}

export const page = (data: unknown[]) => ({data, hasNext: false, hasPrev: false, totalElements: data.length, totalPages: 1})
export const cursor = (data: unknown[]) => ({data, nextCursor: null, hasMore: false})
