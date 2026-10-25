/**
 * The CI session every `test` / `trigger` run of one invocation shares
 * (doc 32 B4.5): `--session <id>`, else the GitHub Actions run, else none.
 * Runs are grouped and listed with `devhelm runs list --session <id>`.
 */
import type {z} from 'zod'
import type {schemas as apiSchemas} from '../api-zod.generated.js'

export type RunSessionContext = z.infer<typeof apiSchemas.RunSessionContext>

export function sessionContext(explicit?: string, env: NodeJS.ProcessEnv = process.env): RunSessionContext | undefined {
  const runId = env.GITHUB_RUN_ID
  const id = explicit ?? (runId ? `gh-${env.GITHUB_REPOSITORY ?? 'repo'}-${runId}-${env.GITHUB_RUN_ATTEMPT ?? '1'}` : undefined)
  if (!id) return undefined
  const ctx: RunSessionContext = {id: id.slice(0, 255)}
  if (env.GITHUB_WORKFLOW) ctx.label = env.GITHUB_WORKFLOW.slice(0, 255)
  if (env.GITHUB_SHA) ctx.commit = env.GITHUB_SHA.slice(0, 64)
  const branch = env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME
  if (branch) ctx.branch = branch.slice(0, 255)
  if (runId && env.GITHUB_REPOSITORY) {
    ctx.url = `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${runId}`
  }
  return ctx
}
