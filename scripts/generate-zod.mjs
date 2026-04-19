#!/usr/bin/env node
/**
 * Generate Zod schemas from the OpenAPI spec for CLI validation.
 *
 * Applies the same Springdoc preprocessing as the dashboard's sync-schema,
 * then runs openapi-zod-client to produce typed Zod schemas that the YAML
 * validation layer imports.
 *
 * Usage: node scripts/generate-zod.mjs
 *
 * Preprocessing logic is kept in sync with packages/openapi-tools in the
 * monorepo. If you change preprocessing there, update it here too.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateZodClientFromOpenAPI } from 'openapi-zod-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SPEC_PATH = join(ROOT, 'docs/openapi/monitoring-api.json');
const OUTPUT_PATH = join(ROOT, 'src/lib/api-zod.generated.ts');

// ── Springdoc preprocessing (synced from packages/openapi-tools) ──────

function setRequiredFields(spec) {
  const schemas = spec.components?.schemas ?? {};
  for (const schema of Object.values(schemas)) {
    if (schema.type !== 'object' || !schema.properties) continue;
    if (Array.isArray(schema.required)) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.nullable) continue;
        if (propSchema.oneOf && !schema.required.includes(prop)) {
          schema.required.push(prop);
        }
      }
      continue;
    }
    const required = [];
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.nullable) continue;
      if (propSchema.allOf) continue;
      required.push(prop);
    }
    if (required.length > 0) schema.required = required;
  }
}

function setRequiredOnAllOfMembers(spec) {
  const schemas = spec.components?.schemas ?? {};
  for (const schema of Object.values(schemas)) {
    if (!Array.isArray(schema.allOf)) continue;
    for (const member of schema.allOf) {
      if (!member.properties) continue;
      if (Array.isArray(member.required)) continue;
      const required = [];
      for (const [prop, propSchema] of Object.entries(member.properties)) {
        if (propSchema.nullable) continue;
        if (propSchema.allOf) continue;
        required.push(prop);
      }
      if (required.length > 0) member.required = required;
    }
  }
}

function pushRequiredIntoAllOf(spec) {
  const schemas = spec.components?.schemas ?? {};
  for (const schema of Object.values(schemas)) {
    if (!Array.isArray(schema.required) || !Array.isArray(schema.allOf)) continue;
    for (const member of schema.allOf) {
      if (!member.properties) continue;
      const memberRequired = [];
      for (const field of schema.required) {
        if (field in member.properties) memberRequired.push(field);
      }
      if (memberRequired.length > 0) {
        member.required = member.required
          ? [...new Set([...member.required, ...memberRequired])]
          : memberRequired;
      }
    }
  }
}

// ── Post-processing (strip Zodios client, keep only Zod schemas) ─────
// Same approach as sdk-js/scripts/generate-schemas.js

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

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading spec from', SPEC_PATH);
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));

  setRequiredFields(spec);
  setRequiredOnAllOfMembers(spec);
  pushRequiredIntoAllOf(spec);
  console.log(`Preprocessed spec (${Object.keys(spec.components?.schemas ?? {}).length} schemas)`);

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
