/**
 * Local state file for tracking which resources were created by `devhelm deploy`.
 * Used for pruning: only delete resources that we manage.
 *
 * State file: .devhelm/state.json (gitignored by convention)
 */
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {join, dirname} from 'node:path'

export interface StateEntry {
  resourceType: string
  refKey: string
  id: string
  createdAt: string
}

export interface DeployState {
  version: string
  lastDeployedAt: string
  resources: StateEntry[]
}

const STATE_DIR = '.devhelm'
const STATE_FILE = 'state.json'
export const STATE_VERSION = '1'

function statePath(cwd: string): string {
  return join(cwd, STATE_DIR, STATE_FILE)
}

export function readState(cwd: string = process.cwd()): DeployState | undefined {
  const path = statePath(cwd)
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as DeployState
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`Warning: corrupt state file at ${path} (${msg}). Treating as fresh state.`)
    return undefined
  }
}

export function writeState(state: DeployState, cwd: string = process.cwd()): void {
  const path = statePath(cwd)
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true})
  }
  writeFileSync(path, JSON.stringify(state, null, 2))
}

export function buildState(entries: StateEntry[]): DeployState {
  return {
    version: STATE_VERSION,
    lastDeployedAt: new Date().toISOString(),
    resources: entries,
  }
}
