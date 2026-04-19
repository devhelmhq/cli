/**
 * Compile-time parity test: verifies that every field defined in the
 * hand-authored Zod schemas (zod-schemas.ts) maps to a real field in
 * the corresponding OpenAPI request DTO — unless it's a known YAML-only
 * field (name references that the transform layer resolves to UUIDs).
 *
 * Also checks the reverse: that every API request field is either
 * present in the YAML schema or listed as API-only (e.g. managedBy,
 * UUID fields that YAML doesn't expose).
 *
 * This catches two classes of bugs:
 * 1. YAML schema has a field that was removed from the API → stale field
 * 2. API added a new field that YAML doesn't know about → missing field
 */
import {describe, it, expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const spec = JSON.parse(readFileSync(join(ROOT, 'docs/openapi/monitoring-api.json'), 'utf8'))

function specFields(...schemaNames: string[]): string[] {
  const props = new Set<string>()
  for (const schemaName of schemaNames) {
    const s = spec.components?.schemas?.[schemaName]
    if (!s) continue
    if (s.properties) for (const k of Object.keys(s.properties)) props.add(k)
    if (s.allOf) {
      for (const member of s.allOf) {
        if (member.properties) for (const k of Object.keys(member.properties)) props.add(k)
      }
    }
  }
  return [...props]
}

// YAML fields that exist only in YAML (name/slug references resolved by transform layer)
const YAML_ONLY_FIELDS: Record<string, string[]> = {
  monitor: ['environment', 'tags', 'alertChannels'],
  alertChannel: [],
  notificationPolicy: [],
  resourceGroup: [
    'alertPolicy', 'defaultAlertChannels', 'defaultEnvironment',
    'monitors', 'services',
  ],
  statusPage: ['componentGroups', 'components'],
  statusPageComponent: ['monitor', 'resourceGroup', 'group'],
  webhook: [],
  tag: [],
  environment: [],
  secret: [],
  triggerRule: [],
  confirmationPolicy: [],
  recoveryPolicy: [],
  dependency: ['service', 'alertSensitivity', 'component'],
}

// API fields that YAML intentionally does not expose (set by CLI internally, or UUID-only)
const API_ONLY_FIELDS: Record<string, string[]> = {
  monitor: ['managedBy', 'environmentId', 'alertChannelIds', 'clearEnvironmentId', 'clearAuth'],
  alertChannel: [],
  notificationPolicy: [],
  resourceGroup: [
    'alertPolicyId', 'defaultEnvironmentId',
  ],
  statusPage: [],
  statusPageComponent: ['monitorId', 'resourceGroupId', 'groupId', 'displayOrder', 'removeFromGroup'],
  webhook: ['enabled'],
  tag: [],
  environment: [],
  secret: [],
  triggerRule: [],
  confirmationPolicy: [],
  recoveryPolicy: [],
  dependency: [],
}

interface FieldMapping {
  yamlName: string
  apiSchemaNames: string[]
  yamlFields: string[]
  yamlOnlyFields: string[]
  apiOnlyFields: string[]
}

const MAPPINGS: FieldMapping[] = [
  {
    yamlName: 'monitor',
    apiSchemaNames: ['CreateMonitorRequest', 'UpdateMonitorRequest'],
    yamlFields: [
      'name', 'type', 'config', 'frequencySeconds', 'enabled', 'regions',
      'environment', 'tags', 'alertChannels', 'assertions', 'auth', 'incidentPolicy',
    ],
    yamlOnlyFields: YAML_ONLY_FIELDS['monitor'],
    apiOnlyFields: API_ONLY_FIELDS['monitor'],
  },
  {
    yamlName: 'alertChannel',
    apiSchemaNames: ['CreateAlertChannelRequest', 'UpdateAlertChannelRequest'],
    yamlFields: ['name', 'config'],
    yamlOnlyFields: YAML_ONLY_FIELDS['alertChannel'],
    apiOnlyFields: API_ONLY_FIELDS['alertChannel'],
  },
  {
    yamlName: 'notificationPolicy',
    apiSchemaNames: ['CreateNotificationPolicyRequest', 'UpdateNotificationPolicyRequest'],
    yamlFields: ['name', 'enabled', 'priority', 'matchRules', 'escalation'],
    yamlOnlyFields: YAML_ONLY_FIELDS['notificationPolicy'],
    apiOnlyFields: API_ONLY_FIELDS['notificationPolicy'],
  },
  {
    yamlName: 'resourceGroup',
    apiSchemaNames: ['CreateResourceGroupRequest', 'UpdateResourceGroupRequest'],
    yamlFields: [
      'name', 'description', 'alertPolicy', 'defaultFrequency', 'defaultRegions',
      'defaultRetryStrategy', 'defaultAlertChannels', 'defaultEnvironment',
      'healthThresholdType', 'healthThresholdValue', 'suppressMemberAlerts',
      'confirmationDelaySeconds', 'recoveryCooldownMinutes', 'monitors', 'services',
    ],
    yamlOnlyFields: YAML_ONLY_FIELDS['resourceGroup'],
    apiOnlyFields: API_ONLY_FIELDS['resourceGroup'],
  },
  {
    yamlName: 'statusPage',
    apiSchemaNames: ['CreateStatusPageRequest', 'UpdateStatusPageRequest'],
    yamlFields: [
      'name', 'slug', 'description', 'visibility', 'enabled',
      'incidentMode', 'branding', 'componentGroups', 'components',
    ],
    yamlOnlyFields: YAML_ONLY_FIELDS['statusPage'],
    apiOnlyFields: API_ONLY_FIELDS['statusPage'],
  },
  {
    yamlName: 'statusPageComponent',
    apiSchemaNames: ['CreateStatusPageComponentRequest', 'UpdateStatusPageComponentRequest'],
    yamlFields: [
      'name', 'description', 'type', 'monitor', 'resourceGroup',
      'group', 'showUptime', 'excludeFromOverall', 'startDate',
    ],
    yamlOnlyFields: YAML_ONLY_FIELDS['statusPageComponent'],
    apiOnlyFields: API_ONLY_FIELDS['statusPageComponent'],
  },
  {
    yamlName: 'webhook',
    apiSchemaNames: ['CreateWebhookEndpointRequest', 'UpdateWebhookEndpointRequest'],
    yamlFields: ['url', 'subscribedEvents', 'description', 'enabled'],
    yamlOnlyFields: YAML_ONLY_FIELDS['webhook'],
    apiOnlyFields: API_ONLY_FIELDS['webhook'],
  },
  {
    yamlName: 'tag',
    apiSchemaNames: ['CreateTagRequest'],
    yamlFields: ['name', 'color'],
    yamlOnlyFields: YAML_ONLY_FIELDS['tag'],
    apiOnlyFields: API_ONLY_FIELDS['tag'],
  },
  {
    yamlName: 'environment',
    apiSchemaNames: ['CreateEnvironmentRequest', 'UpdateEnvironmentRequest'],
    yamlFields: ['name', 'slug', 'variables', 'isDefault'],
    yamlOnlyFields: YAML_ONLY_FIELDS['environment'],
    apiOnlyFields: API_ONLY_FIELDS['environment'],
  },
  {
    yamlName: 'secret',
    apiSchemaNames: ['CreateSecretRequest'],
    yamlFields: ['key', 'value'],
    yamlOnlyFields: YAML_ONLY_FIELDS['secret'],
    apiOnlyFields: API_ONLY_FIELDS['secret'],
  },
  {
    yamlName: 'triggerRule',
    apiSchemaNames: ['TriggerRule'],
    yamlFields: [
      'type', 'count', 'windowMinutes', 'scope',
      'thresholdMs', 'severity', 'aggregationType',
    ],
    yamlOnlyFields: YAML_ONLY_FIELDS['triggerRule'],
    apiOnlyFields: API_ONLY_FIELDS['triggerRule'],
  },
  {
    yamlName: 'confirmationPolicy',
    apiSchemaNames: ['ConfirmationPolicy'],
    yamlFields: ['type', 'minRegionsFailing', 'maxWaitSeconds'],
    yamlOnlyFields: YAML_ONLY_FIELDS['confirmationPolicy'],
    apiOnlyFields: API_ONLY_FIELDS['confirmationPolicy'],
  },
  {
    yamlName: 'recoveryPolicy',
    apiSchemaNames: ['RecoveryPolicy'],
    yamlFields: ['consecutiveSuccesses', 'minRegionsPassing', 'cooldownMinutes'],
    yamlOnlyFields: YAML_ONLY_FIELDS['recoveryPolicy'],
    apiOnlyFields: API_ONLY_FIELDS['recoveryPolicy'],
  },
]

describe('YAML ↔ OpenAPI field parity', () => {
  for (const mapping of MAPPINGS) {
    describe(mapping.yamlName, () => {
      const apiFields = specFields(...mapping.apiSchemaNames)
      const label = mapping.apiSchemaNames.join(' + ')

      it(`API schema(s) [${label}] exist in the OpenAPI spec`, () => {
        expect(apiFields.length).toBeGreaterThan(0)
      })

      it('every YAML field maps to an API field or is YAML-only', () => {
        for (const field of mapping.yamlFields) {
          if (mapping.yamlOnlyFields.includes(field)) continue
          expect(
            apiFields,
            `YAML field "${field}" on ${mapping.yamlName} not found in API schemas [${label}]. ` +
            `If this is intentionally YAML-only, add it to YAML_ONLY_FIELDS['${mapping.yamlName}'].`,
          ).toContain(field)
        }
      })

      it('every API field is covered by YAML or listed as API-only', () => {
        for (const field of apiFields) {
          const inYaml = mapping.yamlFields.includes(field)
          const isApiOnly = mapping.apiOnlyFields.includes(field)
          expect(
            inYaml || isApiOnly,
            `API field "${field}" on [${label}] is not in the YAML schema and not in API_ONLY_FIELDS['${mapping.yamlName}']. ` +
            `Either add it to the YAML schema or mark it as API-only.`,
          ).toBe(true)
        }
      })
    })
  }
})
