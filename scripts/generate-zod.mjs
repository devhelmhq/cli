#!/usr/bin/env node
/**
 * Generate Zod schemas from the OpenAPI spec for CLI validation.
 *
 * Uses @devhelm/openapi-tools for preprocessing (shared with all surfaces),
 * then runs openapi-zod-client to produce typed Zod schemas that the YAML
 * validation layer imports.
 *
 * Usage: node scripts/generate-zod.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preprocessSpec } from '@devhelm/openapi-tools/preprocess';
import { generateZodClientFromOpenAPI } from 'openapi-zod-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SPEC_PATH = join(ROOT, 'docs/openapi/monitoring-api.json');
const OUTPUT_PATH = join(ROOT, 'src/lib/api-zod.generated.ts');

function extractSchemas(raw) {
  const lines = raw.split('\n');
  const kept = [];
  for (const line of lines) {
    if (line.startsWith('const endpoints = makeApi') || line.startsWith('export const api')) break;
    if (line.includes('@zodios/core')) continue;
    kept.push(line);
  }
  return '// @ts-nocheck\n// Auto-generated Zod schemas from OpenAPI spec. DO NOT EDIT.\n' +
    kept.join('\n') + '\n';
}

const FACTS_PATH = join(ROOT, 'src/lib/spec-facts.generated.ts');

/**
 * Extract enum values and constraints from the OpenAPI spec to produce
 * a spec-facts file. These constants replace hand-maintained arrays in
 * zod-schemas.ts and schema.ts — if the API adds a new enum value or
 * changes a constraint, re-running zodgen picks it up automatically.
 */
function generateSpecFacts(spec) {
  const schemas = spec.components?.schemas ?? {};

  function enumsFrom(schemaName, propName) {
    const s = schemas[schemaName];
    if (!s) return null;
    if (s.properties?.[propName]?.enum) return s.properties[propName].enum;
    if (s.allOf) {
      for (const member of s.allOf) {
        if (member.properties?.[propName]?.enum) return member.properties[propName].enum;
        if (member.properties?.[propName]?.items?.enum) return member.properties[propName].items.enum;
      }
    }
    return null;
  }

  const facts = {
    MONITOR_TYPES: enumsFrom('CreateMonitorRequest', 'type'),
    HTTP_METHODS: enumsFrom('HttpMonitorConfig', 'method'),
    DNS_RECORD_TYPES: enumsFrom('DnsMonitorConfig', 'recordTypes'),
    INCIDENT_SEVERITIES: enumsFrom('CreateManualIncidentRequest', 'severity'),
    ASSERTION_SEVERITIES: enumsFrom('CreateAssertionRequest', 'severity'),
    CHANNEL_TYPES: enumsFrom('AlertChannelDto', 'channelType'),
    TRIGGER_RULE_TYPES: enumsFrom('TriggerRule', 'type'),
    TRIGGER_SCOPES: enumsFrom('TriggerRule', 'scope'),
    TRIGGER_SEVERITIES: enumsFrom('TriggerRule', 'severity'),
    TRIGGER_AGGREGATIONS: enumsFrom('TriggerRule', 'aggregationType'),
    ALERT_SENSITIVITIES: enumsFrom('ServiceSubscriptionDto', 'alertSensitivity'),
    HEALTH_THRESHOLD_TYPES: enumsFrom('CreateResourceGroupRequest', 'healthThresholdType'),
    STATUS_PAGE_VISIBILITIES: enumsFrom('CreateStatusPageRequest', 'visibility'),
    STATUS_PAGE_INCIDENT_MODES: enumsFrom('CreateStatusPageRequest', 'incidentMode'),
    STATUS_PAGE_COMPONENT_TYPES: enumsFrom('CreateStatusPageComponentRequest', 'type'),
    SP_INCIDENT_IMPACTS: enumsFrom('CreateStatusPageIncidentRequest', 'impact'),
    SP_INCIDENT_STATUSES: enumsFrom('CreateStatusPageIncidentRequest', 'status'),
    AUTH_TYPES: enumsFrom('MonitorAuthDto', 'authType'),
    MANAGED_BY: enumsFrom('CreateMonitorRequest', 'managedBy'),
    // ``operator`` is duplicated across StatusCodeAssertion, HeaderValueAssertion,
    // JsonPathAssertion, ResponseSizeAssertion, etc. — pull from one
    // representative schema. The validator and Zod layer share this single
    // tuple so a spec change to the comparison operators is picked up
    // automatically by re-running ``zodgen``.
    COMPARISON_OPERATORS: enumsFrom('StatusCodeAssertion', 'operator'),
  };

  const lines = [
    '// Auto-generated from OpenAPI spec. DO NOT EDIT.',
    '// Re-run `npm run zodgen` to regenerate.',
    '',
  ];

  for (const [name, values] of Object.entries(facts)) {
    if (!values) {
      lines.push(`// WARNING: ${name} — enum not found in spec`);
      continue;
    }
    const items = values.map(v => `'${v}'`).join(', ');
    lines.push(`export const ${name} = [${items}] as const`);
    const typeName = name.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join('');
    lines.push(`export type ${typeName} = (typeof ${name})[number]`);
    lines.push('');
  }

  writeFileSync(FACTS_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Generated spec facts (${Object.keys(facts).length} enums) → ${FACTS_PATH}`);
}

async function main() {
  console.log('Reading spec from', SPEC_PATH);
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));

  const { flattened } = preprocessSpec(spec);
  console.log(`Preprocessed spec (${Object.keys(spec.components?.schemas ?? {}).length} schemas)`);
  if (flattened.length > 0) {
    console.log(`  Flattened circular oneOf: ${flattened.join(', ')}`);
  }

  generateSpecFacts(spec);

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  await generateZodClientFromOpenAPI({
    openApiDoc: spec,
    distPath: OUTPUT_PATH,
    options: {
      exportSchemas: true,
    },
  });

  const raw = readFileSync(OUTPUT_PATH, 'utf8');
  const clean = extractSchemas(raw);
  writeFileSync(OUTPUT_PATH, clean, 'utf8');

  const schemaCount = (clean.match(/^const /gm) || []).length;
  console.log(`Generated Zod schemas (${schemaCount} schemas) → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
