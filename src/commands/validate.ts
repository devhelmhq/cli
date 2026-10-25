import {Args, Flags} from '@oclif/core'
import {runtimeCatalog} from '../lib/code/bundle.js'
import {DevhelmCommand, commonFlags} from '../lib/cli/command.js'
import {EXIT_CODES} from '../lib/errors.js'
import {configFiles, fileFlag, projectOutputFlag} from '../lib/project/flags.js'
import {checkBundlesOnline, dryRunMonitors, fetchRefs, findingsToIssues, isPlanFinding, uploadPrepared} from '../lib/project/online.js'
import {formatIssue, ignoredPlaywrightKeys, loadProject, prepareCodeMonitors, type Issue} from '../lib/project/project.js'
import {readStateOrThrow} from '../lib/project/pipeline.js'

export default class Validate extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Validate devhelm.yml: schema, per-type rules, files, import closures, runtime imports, literal secrets — every error in one pass. ' +
    '--online adds the server checks: plan fit, missing secret values per environment, runtime end of life'

  static examples = [
    '<%= config.bin %> validate',
    '<%= config.bin %> validate devhelm.yml',
    '<%= config.bin %> validate --online',
    '<%= config.bin %> validate --online --strict -o json',
  ]

  static args = {
    file: Args.string({description: 'Config file path (default devhelm.yml)'}),
  }

  static flags = {
    ...commonFlags,
    output: projectOutputFlag,
    file: fileFlag,
    online: Flags.boolean({description: 'Also run the server checks (needs a token)', default: false}),
    strict: Flags.boolean({
      description: 'Fail on warnings; with --online, a runtime reaching end of life within 7 days fails',
      default: false,
    }),
    'skip-env': Flags.boolean({
      description: 'Skip environment variable interpolation (syntax check only)',
      default: false,
    }),
  }

  async run() {
    const {args, flags} = await this.parse(Validate)
    const files = configFiles(args.file, flags.file)
    const label = files.join(', ')
    const loaded = loadProject(files, {resolveEnv: !flags['skip-env']})
    const issues: Issue[] = [...loaded.issues]
    let planRefusal = false

    if (loaded.config) {
      const client = flags.online ? this.client() : undefined
      const catalog = await runtimeCatalog(client)
      const {issues: codeIssues} = await prepareCodeMonitors(loaded, catalog)
      issues.push(...codeIssues)
      issues.push(...ignoredPlaywrightKeys(loaded.configDir))

      if (client && !issues.some((i) => i.severity === 'error')) {
        await this.loadMeta({org: loaded.config.org, workspace: loaded.config.workspace})
        issues.push(...await checkBundlesOnline(client))
        issues.push(...await uploadPrepared(client))
        const refs = await fetchRefs(client, loaded.config, readStateOrThrow())
        const dry = await dryRunMonitors(client, loaded.config, refs)
        const eolSoon = (runtimeId: string) => {
          const r = catalog.find((c) => c.id === runtimeId)
          return Boolean(r?.eolAt && Date.parse(r.eolAt) - Date.now() <= 7 * 86_400_000)
        }
        const online = findingsToIssues(dry, {strict: flags.strict, eolSoon})
        planRefusal = dry.findings.some((f) => f.severity === 'ERROR' && isPlanFinding(f))
        issues.push(...online)
      }
    }

    const errors = issues.filter((i) => i.severity === 'error')
    const warnings = issues.filter((i) => i.severity === 'warning')
    const strictFail = flags.strict && warnings.length > 0
    const exit = errors.length > 0 || strictFail
      ? (planRefusal && errors.every((e) => isPlanCode(e.code)) ? EXIT_CODES.PLAN : EXIT_CODES.VALIDATION)
      : EXIT_CODES.SUCCESS
    const valid = exit === EXIT_CODES.SUCCESS

    const config = loaded.config
    const counts: string[] = []
    if (config?.monitors?.length) counts.push(`${config.monitors.length} monitor(s)`)
    if (config?.alertChannels?.length) counts.push(`${config.alertChannels.length} alert channel(s)`)
    if (config?.tags?.length) counts.push(`${config.tags.length} tag(s)`)
    if (config?.environments?.length) counts.push(`${config.environments.length} environment(s)`)
    if (config?.secrets?.length) counts.push(`${config.secrets.length} secret(s)`)
    if (config?.notificationPolicies?.length) counts.push(`${config.notificationPolicies.length} notification policy(ies)`)
    if (config?.webhooks?.length) counts.push(`${config.webhooks.length} webhook(s)`)
    if (config?.resourceGroups?.length) counts.push(`${config.resourceGroups.length} resource group(s)`)
    if (config?.dependencies?.length) counts.push(`${config.dependencies.length} dependency(ies)`)
    if (config?.statusPages?.length) counts.push(`${config.statusPages.length} status page(s)`)

    const asJson = (list: Issue[]) => list.map((i) => ({path: i.path, message: i.message, code: i.code ?? null, file: i.file ?? null, line: i.line ?? null}))
    for (const w of warnings) this.warnings.push(formatIssue(w))
    await this.finish({
      exit,
      // Pre-1.12 fields first (valid, errors, warnings), then the wrapper keys.
      data: this.legacy
        ? {valid, errors: asJson(errors), warnings: asJson(warnings), ok: valid, exit, skipped: [], meta: this.meta ?? null}
        : {valid, errors: asJson(errors), warnings: asJson(warnings), online: flags.online},
      human: () => {
        if (warnings.length > 0) {
          this.log(`\n${label}: ${warnings.length} warning(s)${strictFail ? ' (strict mode)' : ''}\n`)
          for (const w of warnings) this.log(`  ${strictFail ? '✗' : '⚠'} ${formatIssue(w)}`)
          this.log('')
        }
        if (errors.length > 0) {
          this.log(`\n${label}: ${errors.length} error(s)\n`)
          for (const e of errors) this.log(`  ✗ ${formatIssue(e)}`)
          this.log('')
          return
        }
        if (strictFail) return
        this.log(`${label}: valid (${counts.join(', ')})${flags.online ? ' · online checks passed' : ''}`)
      },
    })
  }
}

function isPlanCode(code: string | undefined): boolean {
  return code !== undefined && isPlanFinding({code, upgradeUrl: null, plan: null})
}

