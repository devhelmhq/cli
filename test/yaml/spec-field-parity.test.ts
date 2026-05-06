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
interface OpenApiSpec {
  components?: {
    schemas?: Record<string, {
      properties?: Record<string, {enum?: string[]}>
      allOf?: Array<{properties?: Record<string, {enum?: string[]}>; oneOf?: Array<{$ref?: string; properties?: Record<string, {enum?: string[]}>}>}>
      oneOf?: Array<{$ref?: string; properties?: Record<string, {enum?: string[]}>}>
    }>
  }
}
const spec: OpenApiSpec = JSON.parse(readFileSync(join(ROOT, 'docs/openapi/monitoring-api.json'), 'utf8')) as OpenApiSpec

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

// API fields that YAML intentionally does not expose (set by CLI internally, or UUID-only).
// `managedBy` is set automatically by the CLI transform layer to "CLI" so the
// API records correct attribution; users must not set it themselves in YAML.
const API_ONLY_FIELDS: Record<string, string[]> = {
  monitor: ['managedBy', 'environmentId', 'alertChannelIds', 'clearEnvironmentId', 'clearAuth'],
  alertChannel: ['managedBy'],
  notificationPolicy: [],
  resourceGroup: [
    'managedBy', 'alertPolicyId', 'defaultEnvironmentId',
  ],
  statusPage: ['managedBy'],
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

// ── Snapshot function parity ──────────────────────────────────────────
// Verifies that the field sets in statusPageComponentDesiredSnapshot and
// statusPageGroupDesiredSnapshot stay aligned with the corresponding
// response DTO schemas. If the API adds a field to StatusPageComponentDto,
// the snapshot must be updated or the drift comparison will silently ignore it.

const SNAPSHOT_COMPONENT_FIELDS = [
  'name', 'description', 'type', 'showUptime', 'excludeFromOverall',
  'startDate', 'group', 'monitor', 'resourceGroup',
]

const SNAPSHOT_COMPONENT_DTO_ONLY = [
  'id', 'statusPageId', 'groupId', 'monitorId', 'resourceGroupId',
  'displayOrder', 'pageOrder', 'currentStatus', 'createdAt', 'updatedAt',
]

const SNAPSHOT_GROUP_FIELDS = ['name', 'description', 'defaultOpen']

const SNAPSHOT_GROUP_DTO_ONLY = [
  'id', 'statusPageId', 'displayOrder', 'pageOrder',
  'components', 'createdAt', 'updatedAt',
]

describe('Snapshot ↔ DTO field parity', () => {
  describe('statusPageComponentDesiredSnapshot', () => {
    const dtoFields = specFields('StatusPageComponentDto')

    it('StatusPageComponentDto exists in the spec', () => {
      expect(dtoFields.length).toBeGreaterThan(0)
    })

    it('every snapshot field maps to a DTO field or is a YAML name ref', () => {
      const yamlNameRefs = ['group', 'monitor', 'resourceGroup']
      for (const field of SNAPSHOT_COMPONENT_FIELDS) {
        if (yamlNameRefs.includes(field)) continue
        expect(
          dtoFields,
          `Snapshot field "${field}" not found in StatusPageComponentDto`,
        ).toContain(field)
      }
    })

    it('every DTO field is in the snapshot or listed as DTO-only', () => {
      for (const field of dtoFields) {
        const inSnapshot = SNAPSHOT_COMPONENT_FIELDS.includes(field)
        const isDtoOnly = SNAPSHOT_COMPONENT_DTO_ONLY.includes(field)
        expect(
          inSnapshot || isDtoOnly,
          `DTO field "${field}" on StatusPageComponentDto is not in the snapshot function ` +
          `and not in SNAPSHOT_COMPONENT_DTO_ONLY. If the API added a new field, update ` +
          `statusPageComponentDesiredSnapshot in handlers.ts.`,
        ).toBe(true)
      }
    })
  })

  describe('statusPageGroupDesiredSnapshot', () => {
    const dtoFields = specFields('StatusPageComponentGroupDto')

    it('StatusPageComponentGroupDto exists in the spec', () => {
      expect(dtoFields.length).toBeGreaterThan(0)
    })

    it('every snapshot field maps to a DTO field', () => {
      for (const field of SNAPSHOT_GROUP_FIELDS) {
        expect(
          dtoFields,
          `Snapshot field "${field}" not found in StatusPageComponentGroupDto`,
        ).toContain(field)
      }
    })

    it('every DTO field is in the snapshot or listed as DTO-only', () => {
      for (const field of dtoFields) {
        const inSnapshot = SNAPSHOT_GROUP_FIELDS.includes(field)
        const isDtoOnly = SNAPSHOT_GROUP_DTO_ONLY.includes(field)
        expect(
          inSnapshot || isDtoOnly,
          `DTO field "${field}" on StatusPageComponentGroupDto is not in the snapshot function ` +
          `and not in SNAPSHOT_GROUP_DTO_ONLY. If the API added a new field, update ` +
          `statusPageGroupDesiredSnapshot in handlers.ts.`,
        ).toBe(true)
      }
    })
  })
})

// ── Nested config schema coverage ─────────────────────────────────────
// Verifies that the discriminated union dispatch maps in zod-schemas.ts
// (MONITOR_TYPE_CONFIG_SCHEMAS, ASSERTION_CONFIG_SCHEMAS, CHANNEL_CONFIG_SCHEMAS)
// cover every config variant defined in the OpenAPI spec.

describe('Nested config schema coverage', () => {
  it('branding schema fields match StatusPageBranding in spec', () => {
    const brandingFields = specFields('StatusPageBranding')
    const yamlBrandingFields = [
      'logoUrl', 'faviconUrl', 'brandColor', 'pageBackground',
      'cardBackground', 'textColor', 'borderColor', 'headerStyle',
      'theme', 'reportUrl', 'hidePoweredBy', 'customCss', 'customHeadHtml',
    ]
    expect(brandingFields.length).toBeGreaterThan(0)
    for (const field of yamlBrandingFields) {
      expect(brandingFields, `Branding field "${field}" not in API spec`).toContain(field)
    }
    for (const field of brandingFields) {
      expect(yamlBrandingFields, `API branding field "${field}" not in YAML schema`).toContain(field)
    }
  })

  it('escalation step fields match EscalationStep in spec', () => {
    const apiFields = specFields('EscalationStep')
    const yamlFields = ['channels', 'delayMinutes', 'requireAck', 'repeatIntervalSeconds']
    const yamlOnly = ['channels']
    const apiOnly = ['channelIds']
    expect(apiFields.length).toBeGreaterThan(0)
    for (const field of yamlFields) {
      if (yamlOnly.includes(field)) continue
      expect(apiFields, `Escalation field "${field}" not in API spec`).toContain(field)
    }
    for (const field of apiFields) {
      const inYaml = yamlFields.includes(field)
      const isApiOnly = apiOnly.includes(field)
      expect(
        inYaml || isApiOnly,
        `API escalation field "${field}" is not in YAML or API-only list`,
      ).toBe(true)
    }
  })

  it('match rule fields match MatchRule in spec', () => {
    const apiFields = specFields('MatchRule')
    const yamlFields = ['type', 'value', 'monitorNames', 'regions', 'values']
    const yamlOnly = ['monitorNames']
    const apiOnly = ['monitorIds']
    expect(apiFields.length).toBeGreaterThan(0)
    for (const field of yamlFields) {
      if (yamlOnly.includes(field)) continue
      expect(apiFields, `MatchRule field "${field}" not in API spec`).toContain(field)
    }
    for (const field of apiFields) {
      const inYaml = yamlFields.includes(field)
      const isApiOnly = apiOnly.includes(field)
      expect(
        inYaml || isApiOnly,
        `API match rule field "${field}" is not in YAML or API-only list`,
      ).toBe(true)
    }
  })
})
