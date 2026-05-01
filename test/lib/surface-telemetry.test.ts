import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {buildSurfaceHeaders} from '../../src/lib/surface-telemetry.js'

describe('surface telemetry', () => {
  // Snapshot the env we touch so tests don't pollute one another or the
  // surrounding shell. Each test owns its env state explicitly.
  const SAVED_TELEMETRY = process.env.DEVHELM_TELEMETRY
  const SAVED_INSTALL_SOURCE = process.env.DEVHELM_INSTALL_SOURCE

  beforeEach(() => {
    delete process.env.DEVHELM_TELEMETRY
    delete process.env.DEVHELM_INSTALL_SOURCE
  })

  afterEach(() => {
    if (SAVED_TELEMETRY !== undefined) process.env.DEVHELM_TELEMETRY = SAVED_TELEMETRY
    if (SAVED_INSTALL_SOURCE !== undefined) process.env.DEVHELM_INSTALL_SOURCE = SAVED_INSTALL_SOURCE
  })

  it('emits the canonical surface + version headers by default', () => {
    const h = buildSurfaceHeaders()
    expect(h['X-DevHelm-Surface']).toBe('cli')
    // Version comes from package.json via createRequire; we just assert
    // it's a non-empty string so the test isn't pinned to whatever is
    // currently in package.json.
    expect(h['X-DevHelm-Surface-Version']).toBeTruthy()
  })

  it('reports OS as platform-arch', () => {
    const h = buildSurfaceHeaders()
    expect(h['X-DevHelm-Cli-Os']).toBe(`${process.platform}-${process.arch}`)
  })

  it('honours DEVHELM_INSTALL_SOURCE override', () => {
    process.env.DEVHELM_INSTALL_SOURCE = 'brew'
    expect(buildSurfaceHeaders()['X-DevHelm-Cli-Install-Source']).toBe('brew')

    process.env.DEVHELM_INSTALL_SOURCE = 'docker'
    expect(buildSurfaceHeaders()['X-DevHelm-Cli-Install-Source']).toBe('docker')
  })

  it('reports a sensible install source when no override is set', () => {
    // Detection is heuristic-based; the exact value depends on where the
    // test runner sits (npm vs ts-node vs vitest CLI). We only assert it's
    // one of the closed-set tags the API knows how to bucket.
    const source = buildSurfaceHeaders()['X-DevHelm-Cli-Install-Source']
    expect(['npm', 'brew', 'other']).toContain(source)
  })

  it('drops every surface header when DEVHELM_TELEMETRY=0', () => {
    process.env.DEVHELM_TELEMETRY = '0'
    expect(buildSurfaceHeaders()).toEqual({})
  })

  it('still emits headers when DEVHELM_TELEMETRY is any other value (including "1")', () => {
    // Opt-out semantics are strict: only "0" disables. Any other value (or
    // unset) means telemetry on. This avoids accidentally interpreting
    // "DEVHELM_TELEMETRY=on", "DEVHELM_TELEMETRY=true", etc. as opt-out.
    for (const value of ['1', 'on', 'true', 'yes', '']) {
      process.env.DEVHELM_TELEMETRY = value
      const h = buildSurfaceHeaders()
      expect(h['X-DevHelm-Surface']).toBe('cli')
    }
  })
})
