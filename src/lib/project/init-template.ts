/** The pre-1.12 starter devhelm.yml written by `devhelm init` without --browser / --api. */
export const TEMPLATE = `# devhelm.yml — DevHelm monitoring-as-code configuration
# Docs: https://docs.devhelm.io/cli/configuration
# Run "devhelm validate" to check, "devhelm deploy" to apply.
version: "1"

# defaults:
#   monitors:
#     frequencySeconds: 60
#     regions: [us-east, eu-west]

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
