import {Command, Args} from '@oclif/core'
import {existsSync, readFileSync} from 'node:fs'
import {parse as parseYaml} from 'yaml'

interface MonitorConfig {
  name?: string
  type?: string
  url?: string
  frequency?: number
  interval?: number
}

interface DevhelmConfig {
  monitors?: MonitorConfig[]
}

const VALID_TYPES = new Set(['HTTP', 'DNS', 'TCP', 'ICMP', 'HEARTBEAT', 'MCP_SERVER'])

export default class Validate extends Command {
  static description = 'Validate a devhelm.yml configuration file'

  static examples = [
    '<%= config.bin %> validate',
    '<%= config.bin %> validate devhelm.yml',
  ]

  static args = {
    file: Args.string({description: 'Config file path', default: 'devhelm.yml'}),
  }

  async run() {
    const {args} = await this.parse(Validate)

    if (!existsSync(args.file)) {
      this.error(`File not found: ${args.file}`, {exit: 1})
    }

    const raw = readFileSync(args.file, 'utf8')
    let config: DevhelmConfig

    try {
      config = parseYaml(raw) as DevhelmConfig
    } catch (err) {
      this.error(`Invalid YAML: ${(err as Error).message}`, {exit: 4})
    }

    const errors: string[] = []

    if (!config.monitors || !Array.isArray(config.monitors)) {
      errors.push('Missing or invalid "monitors" array')
    } else {
      for (let i = 0; i < config.monitors.length; i++) {
        const m = config.monitors[i]
        const prefix = `monitors[${i}]`

        if (!m.name) errors.push(`${prefix}: "name" is required`)
        if (!m.type) {
          errors.push(`${prefix}: "type" is required`)
        } else if (!VALID_TYPES.has(m.type.toUpperCase())) {
          errors.push(`${prefix}: invalid type "${m.type}" (must be one of: ${[...VALID_TYPES].join(', ')})`)
        }

        if (m.type && m.type.toUpperCase() !== 'HEARTBEAT' && !m.url) {
          errors.push(`${prefix}: "url" is required for ${m.type} monitors`)
        }

        const freq = m.frequency ?? m.interval
        if (freq !== undefined && (typeof freq !== 'number' || freq < 10)) {
          errors.push(`${prefix}: "frequency" must be a number >= 10`)
        }
      }
    }

    if (errors.length > 0) {
      this.log(`\n${args.file}: ${errors.length} error(s)\n`)
      for (const e of errors) {
        this.log(`  ✗ ${e}`)
      }

      this.log('')
      this.exit(4)
    }

    const count = config.monitors?.length ?? 0
    this.log(`${args.file}: valid (${count} monitor${count !== 1 ? 's' : ''})`)
  }
}
