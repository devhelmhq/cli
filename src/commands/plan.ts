import {Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../lib/cli/command.js'
import {EXIT_CODES} from '../lib/errors.js'
import {configFiles, fileFlag, projectOutputFlag} from '../lib/project/flags.js'
import {codePlanLines, runPipeline, totalChanges, validationRunCount} from '../lib/project/pipeline.js'
import {changesetToJson, formatPlan} from '../lib/yaml/index.js'
import {formatEntitlementWarnings} from '../lib/yaml/entitlements.js'

export default class Plan extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Show what "devhelm deploy" would change: per resource add/change/delete, changed code files, owner, overlays, ' +
    'live-code drift, plan-fit refusals (exit 16) and the validation runs that will be billed'

  static examples = [
    '<%= config.bin %> plan',
    '<%= config.bin %> plan --env production',
    '<%= config.bin %> plan --prune',
    '<%= config.bin %> plan --prune-all',
    '<%= config.bin %> plan --detailed-exitcode',
    '<%= config.bin %> plan -o json',
  ]

  static flags = {
    ...commonFlags,
    output: projectOutputFlag,
    file: fileFlag,
    env: Flags.string({description: 'Only monitors in this environment (slug)'}),
    prune: Flags.boolean({description: 'Include deletions of resources tracked in .devhelm/state.json and monitors this project owns that are absent from the config', default: false}),
    'prune-all': Flags.boolean({
      description: 'Include deletions of ALL resources not in config, including those not managed by the CLI',
      default: false,
    }),
    'detailed-exitcode': Flags.boolean({description: 'Exit 10 when the plan has changes (for CI)', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Plan)
    const client = this.client()
    const files = configFiles(undefined, flags.file)
    if (!this.structured) this.progress('Fetching current state from API...')
    const p = await runPipeline(client, {files, prune: flags.prune || flags['prune-all'], pruneAll: flags['prune-all'], env: flags.env, details: true, applyMoved: false})
    await this.loadMeta({org: p.config.org, workspace: p.config.workspace})
    for (const w of p.warnings) this.addWarning(w)
    for (const u of p.bind.unowned) this.addWarning(`${u.name} exists (${u.owner}) but this project does not own it; deploy needs --adopt "${u.name}"`)

    const runs = validationRunCount(p.codePlans)
    const changes = totalChanges(p.changeset)
    let exit: number = EXIT_CODES.SUCCESS
    if (p.planRefusals.length > 0) exit = EXIT_CODES.PLAN
    else if (changes > 0 && flags['detailed-exitcode']) exit = EXIT_CODES.CHANGES_PENDING

    if (!this.structured) await this.header([p.config.project ? `project ${p.config.project}` : '', flags.env ? `env ${flags.env}` : ''].filter(Boolean))
    const json = changesetToJson(p.changeset)
    const extra = {
      codeMonitors: p.codePlans,
      validationRuns: runs,
      unowned: p.bind.unowned,
      planRefusals: p.planRefusals,
      findings: p.findings,
    }
    await this.finish({
      exit,
      data: {...json, ...extra},
      legacyMergeWrapper: true,
      human: () => {
        if (p.entitlements) this.log(p.entitlements.header)
        this.log(`\n${formatPlan(p.changeset)}`)
        const lines = codePlanLines(p.codePlans)
        if (lines.length > 0) this.log(`\nCode monitors:\n${lines.join('\n')}`)
        if (runs > 0) this.log(`\n${runs} validation run${runs === 1 ? '' : 's'} will be billed`)
        if (p.planRefusals.length > 0) {
          this.log('\nPlan refusals (nothing will be written):')
          for (const f of p.planRefusals) this.log(`  ✗ [${f.code}] ${f.message}${f.upgradeUrl ? ` · ${f.upgradeUrl}` : ''}`)
        }
        if (p.entitlements && p.entitlements.warnings.length > 0) this.log(`\n${formatEntitlementWarnings(p.entitlements.warnings)}`)
      },
    })
  }
}
