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

async function main() {
  console.log('Reading spec from', SPEC_PATH);
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));

  const { flattened } = preprocessSpec(spec);
  console.log(`Preprocessed spec (${Object.keys(spec.components?.schemas ?? {}).length} schemas)`);
  if (flattened.length > 0) {
    console.log(`  Flattened circular oneOf: ${flattened.join(', ')}`);
  }

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
