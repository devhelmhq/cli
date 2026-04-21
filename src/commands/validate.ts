import {Command, Args, Flags} from '@oclif/core'
import {EXIT_CODES} from '../lib/errors.js'
import {parseConfigFile, validate} from '../lib/yaml/index.js'

export default class Validate extends Command {
  static description = 'Validate a devhelm.yml configuration file against the full schema'

  static examples = [
    '<%= config.bin %> validate',
    '<%= config.bin %> validate devhelm.yml',
    '<%= config.bin %> validate --strict',
    '<%= config.bin %> validate -o json',
  ]

  static args = {
    file: Args.string({description: 'Config file path', default: 'devhelm.yml'}),
  }

  static flags = {
    strict: Flags.boolean({
      description: 'Fail on warnings (unresolved cross-references, etc.)',
      default: false,
    }),
    'skip-env': Flags.boolean({
      description: 'Skip environment variable interpolation (syntax check only)',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output format (text or json)',
      options: ['text', 'json'],
      default: 'text',
    }),
  }

  async run() {
    const {args, flags} = await this.parse(Validate)
    const isJson = flags.output === 'json'

    let config
    try {
      config = parseConfigFile(args.file, !flags['skip-env'])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isJson) {
        this.log(JSON.stringify({valid: false, errors: [{path: '', message: msg}], warnings: []}, null, 2))
        this.exit(EXIT_CODES.VALIDATION)
      }
      this.error(msg, {exit: EXIT_CODES.VALIDATION})
    }

    const result = validate(config)
    const hasErrors = result.errors.length > 0
    const hasWarnings = result.warnings.length > 0
    const strictFail = flags.strict && hasWarnings

    if (isJson) {
      this.log(JSON.stringify({
        valid: !hasErrors && !strictFail,
        errors: result.errors,
        warnings: result.warnings,
      }, null, 2))
      if (hasErrors || strictFail) this.exit(EXIT_CODES.VALIDATION)
      return
    }

    if (hasWarnings && !flags.strict) {
      this.log(`\n${args.file}: ${result.warnings.length} warning(s)\n`)
      for (const w of result.warnings) {
        this.log(`  ⚠ ${w.path}: ${w.message}`)
      }
      this.log('')
    }

    if (hasErrors) {
      this.log(`\n${args.file}: ${result.errors.length} error(s)\n`)
      for (const e of result.errors) {
        this.log(`  ✗ ${e.path}: ${e.message}`)
      }
      this.log('')
      this.exit(EXIT_CODES.VALIDATION)
    }

    if (strictFail) {
      this.log(`\n${args.file}: ${result.warnings.length} warning(s) (strict mode)\n`)
      for (const w of result.warnings) {
        this.log(`  ✗ ${w.path}: ${w.message}`)
      }
      this.log('')
      this.exit(EXIT_CODES.VALIDATION)
    }

    const sections: string[] = []
    if (config.monitors?.length) sections.push(`${config.monitors.length} monitor(s)`)
    if (config.alertChannels?.length) sections.push(`${config.alertChannels.length} alert channel(s)`)
    if (config.tags?.length) sections.push(`${config.tags.length} tag(s)`)
    if (config.environments?.length) sections.push(`${config.environments.length} environment(s)`)
    if (config.secrets?.length) sections.push(`${config.secrets.length} secret(s)`)
    if (config.notificationPolicies?.length) sections.push(`${config.notificationPolicies.length} notification policy(ies)`)
    if (config.webhooks?.length) sections.push(`${config.webhooks.length} webhook(s)`)
    if (config.resourceGroups?.length) sections.push(`${config.resourceGroups.length} resource group(s)`)
    if (config.dependencies?.length) sections.push(`${config.dependencies.length} dependency(ies)`)

    this.log(`${args.file}: valid (${sections.join(', ')})`)
  }
}
