/**
 * Per-invocation project context for the YAML engine: the `project:` key,
 * the directory of devhelm.yml (code paths are relative to it), the owner
 * tool the CLI writes (`GIT`; `CLI` on a spec that predates it, R13) and,
 * for code monitors, the prepared closure and its test outcome keyed by
 * monitor name. Set by `plan` / `deploy` / `test` before the differ runs.
 */
import type {components} from '../api.generated.js'
import type {BundleDto, MonitorCodeSpec, PreparedCode} from '../code/bundle.js'
import type {RunDto} from '../runs/wait.js'

type Schemas = components['schemas']
export type ManagedByValue = NonNullable<Schemas['CreateMonitorRequest']['managedBy']>

/** The owner tool the CLI writes (R13: `GIT`; the API reads `CLI` as an alias until 2027-01-31). */
export const OWNER_TOOL: ManagedByValue = 'GIT'

/** Tools that mean "Git / devhelm.yml owns this": `GIT` and its alias `CLI`. */
export function isGitOwner(type: string | null | undefined): boolean {
  return type === 'GIT' || type === 'CLI'
}

export interface CodeMonitorState {
  prepared?: PreparedCode
  /** Runtime the monitor pins (`config.runtimeId`), sent with the upload. */
  runtimeId?: string
  bundle?: BundleDto
  code?: MonitorCodeSpec
  /** Draft revision for a changed monitor. */
  draftRevisionId?: string
  /** Validation run for a new monitor or a draft. */
  run?: RunDto
  /** Why the code half cannot land (test failed, no verdict, upload refused). */
  blocked?: {category: string; code: string; message: string; runUrl?: string | null}
  /** `--no-test`: publish with `PUT … code` without a validation run. */
  untested?: boolean
  /** `--acknowledge-rollback`: the digest this publish re-applies on purpose. */
  acknowledgeRollback?: string
}

export interface ProjectContext {
  project?: string
  configDir: string
  code: Map<string, CodeMonitorState>
}

let current: ProjectContext = {configDir: process.cwd(), code: new Map<string, CodeMonitorState>()}

export function setProjectContext(ctx: Partial<ProjectContext>): ProjectContext {
  current = {configDir: ctx.configDir ?? process.cwd(), project: ctx.project, code: ctx.code ?? new Map<string, CodeMonitorState>()}
  return current
}

export function projectContext(): ProjectContext {
  return current
}

/** `ownerDeclaration.address` the CLI writes: `<project>#monitors.<key|name>`. */
export function ownerAddress(project: string | undefined, keyOrName: string): string | undefined {
  if (!project) return undefined
  return `${project}#monitors.${keyOrName}`.slice(0, 512)
}
