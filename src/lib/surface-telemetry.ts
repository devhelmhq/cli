// Surface telemetry — what the CLI tells the API about itself on every
// authenticated request so the GTM rollup can attribute usage to the CLI
// (vs. SDKs / MCP / Terraform). Wire contract documented at
// https://devhelm.io/telemetry. The matching API-side handler is in mono.
//
// All exports are pure functions of `process.*` so the headers are computed
// once at client construction and never re-evaluated. Opt-out is honoured
// here too — `DEVHELM_TELEMETRY=0` returns an empty headers object and the
// API receives no surface signal at all.

import {createRequire} from 'node:module'
import {realpathSync} from 'node:fs'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json') as {version?: string}

const SURFACE = 'cli'
const CLI_VERSION: string = pkg.version ?? 'unknown'

/**
 * Tag for the OS+arch the CLI is running on. We deliberately keep the
 * alphabet tiny ("darwin-arm64", "linux-x64", "win32-x64", ...) — the API
 * pivots on the prefix when sizing platform-specific test matrices, so a
 * verbose UA string would just churn the cardinality.
 */
function detectOs(): string {
  return `${process.platform}-${process.arch}`
}

/**
 * Heuristic for "how was this CLI installed?". Used by the rollout team to
 * decide where to invest install-experience polish (npm flow vs. brew flow
 * vs. raw download). Not authoritative — happy to return "other" rather
 * than guess wrong.
 *
 * Detection order:
 *   1. Explicit env var DEVHELM_INSTALL_SOURCE — set by the brew formula
 *      (or any other distribution channel) to short-circuit guessing.
 *   2. Path of the running script: brew installs realpath under
 *      /opt/homebrew or /usr/local/Cellar; npm globals live under a
 *      `node_modules` segment somewhere in the path.
 *   3. Otherwise "other".
 */
function detectInstallSource(): string {
  const explicit = process.env['DEVHELM_INSTALL_SOURCE']
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim()
  }

  // process.argv[1] is the script path. Resolve symlinks (brew + nvm both
  // symlink heavily) so we see the actual install location rather than
  // ~/.local/bin/devhelm or similar.
  const scriptPath = process.argv[1]
  if (!scriptPath) {
    return 'other'
  }

  let resolved: string
  try {
    resolved = realpathSync(scriptPath)
  } catch {
    // Fall back to the raw path; some sandboxed envs (CI containers,
    // Snap, AppImage) refuse realpath but still give a usable argv[1].
    resolved = scriptPath
  }

  if (
    resolved.includes('/Cellar/') ||
    resolved.startsWith('/opt/homebrew/') ||
    resolved.startsWith('/home/linuxbrew/')
  ) {
    return 'brew'
  }
  if (resolved.includes('/node_modules/')) {
    return 'npm'
  }
  return 'other'
}

/**
 * Build the X-DevHelm-Surface* headers for one CLI invocation.
 *
 * Returns an empty object when `DEVHELM_TELEMETRY=0` so the API receives
 * no surface signal at all. The opt-out is intentionally a single env var
 * rather than a per-command flag — users opt out once for their shell, not
 * per call site.
 */
export function buildSurfaceHeaders(): Record<string, string> {
  if ((process.env['DEVHELM_TELEMETRY'] ?? '').trim() === '0') {
    return {}
  }
  return {
    'X-DevHelm-Surface': SURFACE,
    'X-DevHelm-Surface-Version': CLI_VERSION,
    'X-DevHelm-Cli-Os': detectOs(),
    'X-DevHelm-Cli-Install-Source': detectInstallSource(),
  }
}
