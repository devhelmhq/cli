import {Command, Args, Flags} from '@oclif/core'
import {parseConfigFile, validate} from '../lib/yaml/index.js'

export default class Validate extends Command {
  static description = 'Validate a devhelm.yml configuration file against the full schema'

  static examples = [
    '<%= config.bin %> validate',
    '<%= config.bin %> validate devhelm.yml',
    '<%= config.bin %> validate --strict',
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
  }

  async run() {
    const {args, flags} = await this.parse(Validate)

    let config
    try {
      config = parseConfigFile(args.file, !flags['skip-env'])
    } catch (err) {
      this.error((err as Error).message, {exit: 1})
    }

    const result = validate(config)

    if (result.warnings.length > 0 && !flags.strict) {
      this.log(`\n${args.file}: ${result.warnings.length} warning(s)\n`)
      for (const w of result.warnings) {
        this.log(`  ⚠ ${w.path}: ${w.message}`)
      }
      this.log('')
    }

    if (result.errors.length > 0) {
      this.log(`\n${args.file}: ${result.errors.length} error(s)\n`)
      for (const e of result.errors) {
        this.log(`  ✗ ${e.path}: ${e.message}`)
      }
      this.log('')
      this.exit(4)
    }

    if (flags.strict && result.warnings.length > 0) {
      this.log(`\n${args.file}: ${result.warnings.length} warning(s) (strict mode)\n`)
      for (const w of result.warnings) {
        this.log(`  ✗ ${w.path}: ${w.message}`)
      }
      this.log('')
      this.exit(4)
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
