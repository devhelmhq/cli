import {Command, Flags} from '@oclif/core'
import {existsSync, writeFileSync} from 'node:fs'
import {EXIT_CODES} from '../lib/errors.js'

const TEMPLATE = `# devhelm.yml — DevHelm monitoring-as-code configuration
# Docs: https://docs.devhelm.io/cli/configuration
# Run "devhelm validate" to check, "devhelm deploy" to apply.
version: "1"

# defaults:
#   monitors:
#     frequencySeconds: 60
#     regions: [us-east, eu-west]
#     enabled: true

tags:
  - name: production
    color: "#EF4444"

# environments:
#   - name: Production
#     slug: production
#     isDefault: true

# secrets:
#   - key: bearer-token
#     value: \${API_TOKEN}

alertChannels:
  - name: ops-slack
    config:
      channelType: slack
      webhookUrl: \${SLACK_WEBHOOK_URL:-https://hooks.slack.com/services/REPLACE_ME}

# notificationPolicies:
#   - name: critical-escalation
#     enabled: true
#     priority: 1
#     escalation:
#       steps:
#         - channels: [ops-slack]
#           delayMinutes: 0

# webhooks:
#   - url: https://hooks.example.com/devhelm
#     subscribedEvents: [monitor.down, monitor.recovered]

# resourceGroups:
#   - name: API Services
#     monitors: [API Health Check]

monitors:
  - name: Website Health Check
    type: HTTP
    config:
      url: https://example.com
      method: GET
      verifyTls: true
    frequencySeconds: 60
    regions: [us-east, eu-west]
    tags: [production]
    alertChannels: [ops-slack]
    assertions:
      - config:
          type: status_code
          expected: "200"
          operator: equals
        severity: fail
      - config:
          type: response_time
          thresholdMs: 2000
        severity: warn
      - config:
          type: ssl_expiry
          minDaysRemaining: 30
        severity: warn

  # - name: API Health Check
  #   type: HTTP
  #   config:
  #     url: https://api.example.com/health
  #     method: GET
  #   frequencySeconds: 30

  # - name: DNS Check
  #   type: DNS
  #   config:
  #     hostname: example.com
  #     recordTypes: [A, AAAA, MX]
  #   frequencySeconds: 300
  #   assertions:
  #     - config:
  #         type: dns_resolves
  #       severity: fail

  # - name: Heartbeat Worker
  #   type: HEARTBEAT
  #   config:
  #     expectedInterval: 120
  #     gracePeriod: 300

  # - name: MCP Assistant
  #   type: MCP_SERVER
  #   config:
  #     command: npx
  #     args: ["-y", "@company/mcp-server"]
  #   frequencySeconds: 300

# dependencies:
#   - service: github
#     alertSensitivity: INCIDENTS_ONLY
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
      this.error(
        `${flags.path} already exists. Use --force to overwrite.`,
        {exit: EXIT_CODES.VALIDATION},
      )
    }

    try {
      writeFileSync(flags.path, TEMPLATE)
    } catch (err) {
      // Filesystem failure (read-only FS, no perms, disk full) — leave at the
      // generic exit code; this isn't a config validation issue.
      this.error(
        `Failed to write ${flags.path}: ${err instanceof Error ? err.message : String(err)}`,
        {exit: EXIT_CODES.GENERAL},
      )
    }
    this.log(`Created ${flags.path}`)
    this.log('Edit the file, then run "devhelm validate" to check it.')
    this.log('When ready, run "devhelm deploy" to apply it to your DevHelm account.')
  }
}
