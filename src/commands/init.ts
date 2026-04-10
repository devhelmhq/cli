import {Command, Flags} from '@oclif/core'
import {existsSync, writeFileSync} from 'node:fs'

const TEMPLATE = `# devhelm.yml — DevHelm monitor configuration
# Docs: https://docs.devhelm.io/cli/configuration

monitors:
  - name: Website Health Check
    type: HTTP
    url: https://example.com
    frequency: 60
    regions:
      - us-east-1
      - eu-west-1
    assertions:
      - type: STATUS_CODE
        operator: EQUALS
        value: "200"
      - type: RESPONSE_TIME
        operator: LESS_THAN
        value: "2000"
    alertChannels:
      - default-slack

  # - name: API Endpoint
  #   type: HTTP
  #   url: https://api.example.com/health
  #   method: GET
  #   frequency: 30
  #   timeout: 10000

  # - name: DNS Check
  #   type: DNS
  #   url: example.com
  #   frequency: 300

  # - name: Heartbeat
  #   type: HEARTBEAT
  #   frequency: 120
  #   grace: 300
`

export default class Init extends Command {
  static description = 'Create a starter devhelm.yml configuration file'

  static examples = [
    '<%= config.bin %> init',
    '<%= config.bin %> init --path monitoring.yml',
  ]

  static flags = {
    path: Flags.string({description: 'Output file path', default: 'devhelm.yml'}),
    force: Flags.boolean({description: 'Overwrite existing file', default: false}),
  }

  async run() {
    const {flags} = await this.parse(Init)

    if (existsSync(flags.path) && !flags.force) {
      this.error(`${flags.path} already exists. Use --force to overwrite.`, {exit: 1})
    }

    writeFileSync(flags.path, TEMPLATE)
    this.log(`Created ${flags.path}`)
    this.log('Edit the file, then run `devhelm validate` to check it.')
  }
}
