/**
 * `devhelm test --from-terraform <dir>`: read `terraform show -json` of a
 * saved plan (or the state) and test every `devhelm_monitor` with a
 * `code` block, from the plan's entrypoint, include set, environment,
 * regions and runtime. HCL is never parsed.
 */
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {ValidationError} from '../errors.js'
import type {YamlMonitor} from '../yaml/index.js'

interface TfResource {
  address?: string
  type?: string
  values?: Record<string, unknown>
}

interface TfModule {
  resources?: TfResource[]
  child_modules?: TfModule[]
}

export interface TerraformTarget {
  address: string
  monitor: YamlMonitor
  environmentId?: string
  root: string
}

function walk(m: TfModule | undefined, out: TfResource[]): void {
  if (!m) return
  out.push(...(m.resources ?? []))
  for (const c of m.child_modules ?? []) walk(c, out)
}

const PLAN_FILES = ['tfplan', 'plan.tfplan', 'terraform.tfplan']

export function readTerraformTargets(dir: string): TerraformTarget[] {
  const abs = resolve(dir)
  const planFile = PLAN_FILES.map((f) => join(abs, f)).find((f) => existsSync(f))
  if (!planFile) {
    throw new ValidationError(`No saved Terraform plan in ${dir}. Run: (cd ${dir} && terraform plan -out=tfplan)`, {
      code: 'TERRAFORM_PLAN_MISSING',
      next: {command: `terraform -chdir=${dir} plan -out=tfplan`, docs: null},
    })
  }
  let raw: string
  try {
    raw = execFileSync('terraform', ['show', '-json', planFile], {cwd: abs, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024})
  } catch (err) {
    throw new ValidationError(`terraform show -json failed in ${dir}: ${err instanceof Error ? err.message : String(err)}`, {code: 'TERRAFORM_SHOW_FAILED'})
  }
  const doc = JSON.parse(raw) as {planned_values?: {root_module?: TfModule}; values?: {root_module?: TfModule}}
  const resources: TfResource[] = []
  walk(doc.planned_values?.root_module ?? doc.values?.root_module, resources)
  const out: TerraformTarget[] = []
  for (const r of resources) {
    if (r.type !== 'devhelm_monitor' || !r.values) continue
    const v = r.values
    const code = v.code as {entrypoint?: string; include?: string[] | null; root?: string | null} | null | undefined
    const type = String(v.type ?? '')
    let config: Record<string, unknown> | undefined
    if (typeof v.config === 'string' && v.config) {
      try {
        config = JSON.parse(v.config) as Record<string, unknown>
      } catch {
        config = undefined
      }
    }
    const monitor: YamlMonitor = {
      name: String(v.name ?? r.address ?? 'monitor'),
      type: type as YamlMonitor['type'],
      config: config as YamlMonitor['config'],
      regions: Array.isArray(v.regions) ? (v.regions as string[]) : undefined,
    }
    if (code?.entrypoint) monitor.code = code.include && code.include.length > 0 ? {entrypoint: code.entrypoint, include: code.include} : code.entrypoint
    out.push({
      address: r.address ?? monitor.name,
      monitor,
      environmentId: typeof v.environment_id === 'string' ? v.environment_id : undefined,
      root: code?.root ? resolve(abs, code.root) : abs,
    })
  }
  return out
}
