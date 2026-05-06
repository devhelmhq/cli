#!/usr/bin/env node
/**
 * Extracts field descriptions from the OpenAPI spec and writes a TypeScript
 * map that resources.ts can import for CLI flag help text.
 *
 * Usage: node scripts/extract-descriptions.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, '../docs/openapi/monitoring-api.json');
const OUT_PATH = resolve(__dirname, '../src/lib/descriptions.generated.ts');

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
const schemas = spec.components?.schemas ?? {};

// Schemas we care about for CLI flag descriptions.
// Keep in sync with MUST_HAVE in tests/spec/test_openapi_descriptions.py (monorepo).
const TARGET_SCHEMAS = [
  'CreateMonitorRequest', 'UpdateMonitorRequest',
  'CreateManualIncidentRequest',
  'CreateAlertChannelRequest', 'UpdateAlertChannelRequest',
  'CreateNotificationPolicyRequest', 'UpdateNotificationPolicyRequest',
  'CreateEnvironmentRequest', 'UpdateEnvironmentRequest',
  'CreateSecretRequest', 'UpdateSecretRequest',
  'CreateTagRequest', 'UpdateTagRequest',
  'CreateResourceGroupRequest', 'UpdateResourceGroupRequest',
  'CreateWebhookEndpointRequest', 'UpdateWebhookEndpointRequest',
  'CreateApiKeyRequest', 'UpdateApiKeyRequest',
  'CreateMaintenanceWindowRequest', 'UpdateMaintenanceWindowRequest',
  'ResolveIncidentRequest', 'MonitorTestRequest',
  'AcquireDeployLockRequest',
  'HttpMonitorConfig', 'TcpMonitorConfig', 'DnsMonitorConfig',
  'IcmpMonitorConfig', 'HeartbeatMonitorConfig', 'McpServerMonitorConfig',
  'SlackChannelConfig', 'DiscordChannelConfig', 'EmailChannelConfig',
  'WebhookChannelConfig', 'PagerDutyChannelConfig', 'OpsGenieChannelConfig',
  'TeamsChannelConfig', 'EscalationChain', 'EscalationStep', 'MatchRule',
];

const result = {};

for (const name of TARGET_SCHEMAS) {
  const schema = schemas[name];
  if (!schema) continue;

  const props = schema.properties ?? {};
  // Also check allOf for inherited properties
  const allOfProps = (schema.allOf ?? []).reduce((acc, part) => {
    return { ...acc, ...(part.properties ?? {}) };
  }, {});
  const merged = { ...allOfProps, ...props };

  const descriptions = {};
  for (const [field, def] of Object.entries(merged)) {
    if (def.description) {
      descriptions[field] = def.description;
    }
  }
  if (Object.keys(descriptions).length > 0) {
    result[name] = descriptions;
  }
}

const lines = [
  '// Auto-generated from OpenAPI spec — do not edit manually.',
  '// Regenerate with: node scripts/extract-descriptions.mjs',
  '',
  'export const fieldDescriptions: Record<string, Record<string, string>> = ',
  JSON.stringify(result, null, 2),
  '',
];

writeFileSync(OUT_PATH, lines.join('\n'));

const totalSchemas = Object.keys(result).length;
const totalFields = Object.values(result).reduce((sum, s) => sum + Object.keys(s).length, 0);
console.log(`✅ Extracted ${totalFields} descriptions from ${totalSchemas} schemas → ${OUT_PATH}`);
