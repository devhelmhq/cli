import {hostname} from 'node:os'
import {Flags} from '@oclif/core'
import {checkedFetch, apiDelete, type ApiClient} from '../../lib/api-client.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../../lib/cli/command.js'
import {parseDurationMs} from '../../lib/cli/flags.js'
import {ConflictError, DevhelmError, EXIT_CODES, OwnershipError, PlanLimitError, type JsonValue} from '../../lib/errors.js'
import {adoptMonitor, runTestPhase} from '../../lib/project/code-deploy.js'
import {configFiles, fileFlag, projectOutputFlag} from '../../lib/project/flags.js'
import {codePlanLines, runPipeline, totalChanges, validationRunCount, type PipelineResult} from '../../lib/project/pipeline.js'
import {formatDuration} from '../../lib/runs/outcome.js'
import {sessionContext} from '../../lib/runs/session.js'
import {usageLine} from '../../lib/runs/usage.js'
import {
  apply, buildStateV2, changesetToJson, formatPlan, processMovedBlocks, readState, resourceAddress, writeState,
  type ApplyResult, type Change,
} from '../../lib/yaml/index.js'

const MAX_LOCK_TTL_MINUTES = 60

const NOTHING_LANDED = {landed: [], notLanded: [], failures: []}

export default class Deploy extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Deploy devhelm.yml. New code monitors run a validation run before they are created; changed code goes draft → test → ' +
    'publish (requireTested). A monitor whose test fails stays on its live code. Exit 13 if anything did not land'

  static examples = [
    '<%= config.bin %> deploy',
    '<%= config.bin %> deploy --yes --lock-timeout 5m',
    '<%= config.bin %> deploy --env production --prune --yes',
    '<%= config.bin %> deploy --prune-org-cli --yes',
    '<%= config.bin %> deploy --prune-all --yes',
    '<%= config.bin %> deploy --adopt "Checkout" --yes',
    '<%= config.bin %> deploy --acknowledge-rollback "Checkout" --yes',
    '<%= config.bin %> deploy --dry-run',
  ]

  static flags = {
    ...commonFlags,
    ...yesFlag,
    output: projectOutputFlag,
    file: fileFlag,
    env: Flags.string({description: 'Only monitors in this environment (slug)'}),
    'no-test': Flags.boolean({description: 'Publish code without a validation run (PUT with code; untested)', default: false}),
    prune: Flags.boolean({description: 'Delete resources tracked in .devhelm/state.json and monitors this project owns that are absent from the config', default: false}),
    'prune-org-cli': Flags.boolean({
      description:
        'Also delete CLI-managed resources elsewhere in the org that are absent from YAML. ' +
        'Use with caution in shared workspaces; widens --prune to the legacy org-wide CLI scope.',
      default: false,
    }),
    'prune-all': Flags.boolean({
      description:
        'Delete ALL resources not in YAML, including dashboard- and Terraform-managed ones. ' +
        'The most destructive option; intended for single-tenant workspaces or scripted teardowns.',
      default: false,
    }),
    adopt: Flags.string({description: 'Take over an existing monitor of that name (transfer to Git, this project); repeatable', multiple: true}),
    'acknowledge-rollback': Flags.string({description: 'Re-publish over an emergency rollback of this monitor, for this run only; repeatable', multiple: true}),
    'lock-timeout': Flags.string({description: 'How long to wait for a held deploy lock (e.g. 5m; 0 = fail at once)', default: '0'}),
    'no-lock': Flags.boolean({description: 'Skip the deploy lock (not recommended for team use)', default: false}),
    'force-unlock': Flags.boolean({description: 'Force-release a held deploy lock first (audited)', default: false}),
    'test-concurrency': Flags.integer({description: 'Validation runs started in parallel', default: 5, min: 1}),
    timeout: Flags.string({description: 'Bounds the whole deploy (default 15m); monitors whose test has not finished do not land', default: '15m'}),
    'dry-run': Flags.boolean({description: 'Show what would change without applying (same as "devhelm plan")', default: false}),
    'detailed-exitcode': Flags.boolean({description: 'With --dry-run: exit 10 when there are changes', default: false}),
    session: Flags.string({description: 'Group the validation runs under a session id (default: the CI run)'}),
  }

  async run() {
    const {flags} = await this.parse(Deploy)
    const timeoutMs = parseDurationMs(flags.timeout, 'timeout')
    const lockTimeoutMs = parseDurationMs(flags['lock-timeout'], 'lock-timeout')
    const deadline = Date.now() + timeoutMs
    const client = this.client()
    const files = configFiles(undefined, flags.file)
    if (!this.structured) this.progress('Fetching current state from API...')

    const p = await runPipeline(client, {
      files,
      // The wider scopes imply --prune.
      prune: flags.prune || flags['prune-org-cli'] || flags['prune-all'],
      pruneOrgCli: flags['prune-org-cli'] || flags['prune-all'],
      pruneAll: flags['prune-all'],
      env: flags.env,
      adopt: flags.adopt, details: true, applyMoved: false})
    await this.loadMeta({org: p.config.org, workspace: p.config.workspace})
    for (const w of p.warnings) this.addWarning(w)
    const changes = totalChanges(p.changeset) + p.bind.adopt.length
    const runs = validationRunCount(p.codePlans)
    const planJson = changesetToJson(p.changeset)

    if (!this.structured) {
      await this.header([p.config.project ? `project ${p.config.project}` : '', flags.env ? `env ${flags.env}` : ''].filter(Boolean))
      if (p.entitlements) this.log(p.entitlements.header)
      this.log(`\n${formatPlan(p.changeset)}`)
      const lines = codePlanLines(p.codePlans)
      if (lines.length > 0) this.log(`\nCode monitors:\n${lines.join('\n')}`)
      if (runs > 0 && !flags['no-test']) this.log(`\n${runs} validation run${runs === 1 ? '' : 's'} will be billed`)
      this.log('')
    }

    if (flags['dry-run']) {
      const exit = changes > 0 && flags['detailed-exitcode'] ? EXIT_CODES.CHANGES_PENDING : EXIT_CODES.SUCCESS
      await this.finish({exit, data: {plan: planJson, result: {succeeded: [], failed: []}}, extra: NOTHING_LANDED, legacyMergeWrapper: true, human: () => this.log('Dry run — no changes applied.')})
      return
    }

    this.preflight(p, flags['acknowledge-rollback'] ?? [])

    if (changes === 0) {
      await this.finish({data: {plan: planJson, result: {succeeded: [], failed: []}}, extra: NOTHING_LANDED, legacyMergeWrapper: true, human: () => this.log('No changes.')})
      return
    }

    await this.confirm({
      action: 'deploy',
      changes: deployChanges(p),
      confirmCommand: ['devhelm deploy', ...this.argv.filter((a) => a !== '--yes' && a !== '-y' && !a.startsWith('--api-token')), '--yes'].join(' '),
      yes: flags.yes,
      prompt: 'Apply these changes?',
    })

    if (p.config.moved && p.config.moved.length > 0) {
      const current = readState()
      if (current) {
        for (const w of processMovedBlocks(current, p.config.moved)) this.addWarning(w)
        writeState(current)
      }
    }

    let lockId: string | undefined
    if (!flags['no-lock']) lockId = await this.acquireLock(client, flags['force-unlock'], lockTimeoutMs, Math.ceil((timeoutMs + lockTimeoutMs) / 60_000) + 5)

    let result: ApplyResult
    try {
      for (const m of p.bind.adopt) {
        const after = await adoptMonitor(client, m, p.config.project, 'devhelm deploy --adopt')
        this.human(`  ⇄ ${m.name}: owner ${ownerText(m)} → ${ownerText(after)}  (undo: devhelm monitors transfer ${m.id} --to ${(m.owner?.type ?? m.managedBy ?? 'dashboard').toString().toLowerCase()} --reason "undo adopt")`)
      }
      const ack = new Set(flags['acknowledge-rollback'] ?? [])
      result = await apply(p.changeset, p.refs, client, p.state, {
        beforeMonitors: () => runTestPhase(client, p.config, p.refs, {
          concurrency: flags['test-concurrency'],
          timeoutMs: Math.max(1000, deadline - Date.now()),
          noTest: flags['no-test'],
          session: sessionContext(flags.session),
          acknowledgeRollback: ack,
          plans: p.codePlans,
          onStart: (name, run) => this.human(`  ▸ ${name}  validation run ${run.id} · ${run.region}`),
          onDone: (name, run, flaky) => {
            if (!run) return
            const sym = run.outcome === 'passed' || run.outcome === 'passed_on_retry' ? '✓' : '✗'
            this.human(`  ${sym} ${name}  ${run.outcome ?? run.phase} ${formatDuration(run.durationMs)}${run.url ? ` · ${run.url}` : ''}`)
            if (flaky) this.addWarning(`${name}: the validation run passed only after a retry (flaky); published anyway`)
          },
        }),
      })
    } finally {
      if (lockId) await this.releaseLock(client, lockId)
    }

    this.saveState(p, result)

    const ctx = p.refs.project
    const landed = result.succeeded.map((s) => ({action: s.action, resourceType: s.resourceType, name: s.refKey, id: s.id ?? null, runUrl: ctx.code.get(s.refKey)?.run?.url ?? null}))
    const notLanded = result.failed.map((f) => ({
      action: f.action, resourceType: f.resourceType, name: f.refKey, half: f.half ?? 'both',
      category: f.category ?? 'platform', code: f.code ?? null, message: f.error, runUrl: f.runUrl ?? null,
      draftRevisionId: ctx.code.get(f.refKey)?.draftRevisionId ?? null,
    }))
    const failures = notLanded.map((n) => ({name: n.name, category: n.category, code: n.code, message: n.message}))
    let exit: number = EXIT_CODES.SUCCESS
    if (result.failed.length > 0) {
      const platformOnly = result.failed.every((f) => f.category === 'platform' || f.category === 'transport' || f.category === 'rate_limit')
      exit = result.succeeded.length === 0 && platformOnly ? EXIT_CODES.NO_VERDICT : EXIT_CODES.PARTIAL_FAILURE
    }
    const billed = [...ctx.code.values()].filter((s) => s.run?.billable).length
    const usage = runs > 0 ? await usageLine(client, billed) : undefined

    await this.finish({
      exit,
      data: {plan: planJson, result: {succeeded: result.succeeded, failed: result.failed}, billedRuns: billed},
      extra: {landed, notLanded, failures},
      legacyMergeWrapper: true,
      human: () => {
        for (const s of result.succeeded) this.log(`  ${icon(s.action)} ${s.resourceType} "${s.refKey}" — ${pastTense(s.action)}`)
        for (const f of notLanded) {
          this.log(`  ✗ ${f.resourceType} "${f.name}" — not landed (${f.category}${f.code ? ` ${f.code}` : ''}): ${f.message}`)
          if (f.runUrl) this.log(`      ${f.runUrl}`)
          if (f.draftRevisionId) this.log(`      draft kept: ${f.draftRevisionId}`)
        }
        this.log(`\nDone: ${result.succeeded.length} succeeded, ${result.failed.length} failed.${usage ? ` ${usage.line}` : ''}`)
      },
    })
  }


  /** Pre-flight: nothing is written when any of these refuse (exits 16, 17, 18). */
  private preflight(p: PipelineResult, acknowledged: string[]): void {
    if (p.planRefusals.length > 0) {
      throw new PlanLimitError(`The plan does not allow this config: ${p.planRefusals.map((f) => `[${f.code}] ${f.message}`).join('; ')}`, {
        code: p.planRefusals[0]!.code,
        upgradeUrl: p.planRefusals[0]!.upgradeUrl ?? undefined,
        details: {findings: p.planRefusals.map((f) => ({code: f.code, message: f.message, monitor: typeof f.monitor === 'string' ? f.monitor : null}))},
      })
    }
    if (p.bind.unowned.length > 0) {
      const names = p.bind.unowned.map((u) => `"${u.name}" (${u.owner})`).join(', ')
      throw new OwnershipError(`Would adopt ${p.bind.unowned.length} monitor(s) this project does not own: ${names}. Re-run with --adopt for each`, {
        code: 'MONITOR_OWNED_BY_OTHER',
        reason: 'ownership',
        next: {command: `devhelm deploy ${p.bind.unowned.map((u) => `--adopt "${u.name}"`).join(' ')}`, docs: null},
        details: {unowned: p.bind.unowned.map((u) => ({name: u.name, id: u.id, owner: u.owner}))},
      })
    }
    const rolledBack = p.codePlans.filter((c) => c.republishesRolledBack && !acknowledged.includes(c.name))
    if (rolledBack.length > 0) {
      throw new ConflictError(`${rolledBack.map((c) => c.name).join(', ')}: the code in devhelm.yml is the revision that was rolled back. Revert the file, or re-publish over the rollback on purpose`, {
        code: 'REVISION_ROLLED_BACK',
        next: {command: `devhelm deploy ${rolledBack.map((c) => `--acknowledge-rollback "${c.name}"`).join(' ')}`, docs: null},
      })
    }

  }

  private saveState(p: PipelineResult, result: ApplyResult): void {
    const current = readState() ?? p.state
    const deleted = new Set(result.deletedRefKeys.map((d) => resourceAddress(d.resourceType, d.refKey)))
    const next = buildStateV2(result.stateEntries, current.serial)
    for (const [addr, entry] of Object.entries(current.resources)) {
      if (!(addr in next.resources) && !deleted.has(addr)) next.resources[addr] = entry
    }
    writeState(next)
  }

  private async acquireLock(client: ApiClient, forceUnlock: boolean, timeoutMs: number, ttlMinutes: number): Promise<string | undefined> {
    if (forceUnlock) {
      try {
        await apiDelete(client, '/api/v1/deploy/lock/force?reason=' + encodeURIComponent('devhelm deploy --force-unlock'))
      } catch (err) {
        if (!(err instanceof DevhelmError) || err.category !== 'not_found') throw err
      }
    }
    const deadline = Date.now() + timeoutMs
    while (true) {
      try {
        const resp = await checkedFetch(client.POST('/api/v1/deploy/lock', {
          body: {lockedBy: `${process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_REPOSITORY}#${process.env.GITHUB_RUN_ID ?? ''}` : process.env.USER ?? 'cli'}@${hostname()}`, ttlMinutes: Math.min(MAX_LOCK_TTL_MINUTES, ttlMinutes)},
        }))
        return resp?.data?.id
      } catch (err) {
        if (err instanceof ConflictError && Date.now() < deadline) {
          this.progress(`Deploy lock held (${err.message}). Retrying… ${Math.ceil((deadline - Date.now()) / 1000)}s left`)
          await new Promise((r) => setTimeout(r, Math.min(5000, Math.max(0, deadline - Date.now()))))
          continue
        }
        throw err
      }
    }
  }

  private async releaseLock(client: ApiClient, lockId: string): Promise<void> {
    try {
      await apiDelete(client, `/api/v1/deploy/lock/${lockId}`)
    } catch (err) {
      this.addWarning(`Failed to release deploy lock ${lockId}: ${err instanceof Error ? err.message : String(err)} (it expires on its own)`)
    }
  }
}

function deployChanges(p: PipelineResult): JsonValue[] {
  const one = (c: Change): JsonValue => ({action: c.action, resourceType: c.resourceType, name: c.refKey})
  return [
    ...p.bind.adopt.map((m): JsonValue => ({action: 'adopt', resourceType: 'monitor', name: m.name, owner: ownerText(m)})),
    ...p.changeset.creates.map(one), ...p.changeset.updates.map(one), ...p.changeset.deletes.map(one),
    ...p.changeset.memberships.map(one),
  ]
}

function ownerText(m: {managedBy?: string | null; owner?: {type?: string | null; project?: string | null} | null}): string {
  const type = m.owner?.type ?? m.managedBy ?? 'unknown'
  return m.owner?.project ? `${type} · ${m.owner.project}` : String(type)
}

function icon(action: string): string {
  switch (action) {
    case 'create': case 'add': return '+'
    case 'update': return '~'
    case 'delete': case 'remove': return '-'
    default: return '•'
  }
}

function pastTense(action: string): string {
  switch (action) {
    case 'create': return 'created'
    case 'update': return 'updated'
    case 'delete': return 'deleted'
    case 'add': return 'added'
    case 'remove': return 'removed'
    default: return action
  }
}
