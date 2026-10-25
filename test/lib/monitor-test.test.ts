import {describe, expect, test} from 'vitest'
import {buildCodeTestTarget, queuedRunFrom} from '../../src/lib/monitor-test.js'
import {DevhelmValidationError} from '../../src/lib/errors.js'

const PROBE_RESULT = {
  passed: true,
  error: null,
  statusCode: 200,
  responseTimeMs: 42,
  responseHeaders: null,
  bodyPreview: null,
  responseSizeBytes: null,
  redirectCount: null,
  finalUrl: null,
  assertionResults: [],
  warnings: null,
}

export const QUEUED_RUN = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  organizationId: 1,
  monitorId: '11111111-1111-4111-8111-111111111111',
  monitorName: 'Checkout flow',
  monitorType: 'BROWSER',
  revisionId: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
  region: 'us-east',
  source: 'VALIDATION',
  countsTowardHealth: false,
  enqueuedAt: '2026-10-21T10:00:00Z',
  phase: 'QUEUED',
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
  billable: false,
}

describe('buildCodeTestTarget', () => {
  test('sends no body when no target flag is given', () => {
    expect(buildCodeTestTarget({})).toBeUndefined()
  })

  test('maps flags onto the request body', () => {
    expect(
      buildCodeTestTarget({'environment-id': '8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1e', region: 'eu-west'}),
    ).toEqual({environmentId: '8b9c0d1e-2f3a-4b4c-9d5e-6f7a8b9c0d1e', region: 'eu-west'})
    expect(buildCodeTestTarget({region: 'eu-west'})).toEqual({region: 'eu-west'})
  })
})

describe('queuedRunFrom', () => {
  test('ignores a 200 body (printed unchanged by the command)', () => {
    expect(queuedRunFrom(200, {data: PROBE_RESULT}, 'ctx')).toBeUndefined()
  })

  test('validates a 202 body as the queued run', () => {
    expect(queuedRunFrom(202, {data: QUEUED_RUN}, 'ctx')?.id).toBe(QUEUED_RUN.id)
  })

  test('tolerates additive fields and new enum values on the run', () => {
    expect(queuedRunFrom(202, {data: {...QUEUED_RUN, phase: 'FUTURE', extra: 1}}, 'ctx')).toBeDefined()
  })

  test('rejects a 202 body that is not a run', () => {
    expect(() => queuedRunFrom(202, {data: PROBE_RESULT}, 'ctx')).toThrow(DevhelmValidationError)
  })
})
