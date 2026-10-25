#!/usr/bin/env node
/**
 * Generate `skills/devhelm-<skill>/references/_generated/<resource>.fields.md`
 * from the vendored OpenAPI spec.
 *
 * Each skill reference is a focused field listing for one resource type,
 * covering the Create / Update request shapes and the primary Dto (response)
 * shape. The agent reads these alongside the hand-written reference to get
 * the exact current field surface without us re-documenting fields in prose.
 *
 * Usage:  node scripts/generate-skill-references.mjs
 *
 * Output is idempotent: re-running produces byte-identical files. The
 * openapi-drift test (`test/skills/openapi-drift.test.ts`) depends on this.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preprocessSpec } from './lib/preprocess.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SPEC_PATH = join(ROOT, 'docs/openapi/monitoring-api.json');

/**
 * Map each skill + resource to the OpenAPI schema names we care about.
 * `schemas` lists exact schema names instead. Otherwise schema names
 * follow Springdoc conventions:
 *   Create<Foo>Request / Update<Foo>Request / <Foo>Dto
 * where <Foo> is the PascalCase singular. We look up all three; missing
 * ones are skipped silently (not every resource has a Create endpoint).
 */
const RESOURCES = {
  'devhelm-configure': {
    monitors: { singular: 'Monitor' },
    'alert-channels': { singular: 'AlertChannel' },
    'notification-policies': { singular: 'NotificationPolicy' },
    'resource-groups': { singular: 'ResourceGroup' },
    dependencies: { singular: 'Dependency' },
    secrets: { singular: 'Secret' },
    tags: { singular: 'Tag' },
    webhooks: { singular: 'Webhook' },
    environments: { singular: 'Environment' },
  },
  'devhelm-investigate': {
    'check-results': { singular: 'CheckResult', readOnly: true },
    incidents: { singular: 'Incident' },
    'audit-events': { singular: 'AuditEvent', readOnly: true },
  },
  'devhelm-communicate': {
    'status-pages': { singular: 'StatusPage' },
    'status-page-components': { singular: 'StatusPageComponent' },
    'status-page-incidents': { singular: 'StatusPageIncident' },
    'status-page-maintenance': { singular: 'StatusPageMaintenance' },
    'status-page-subscribers': { singular: 'StatusPageSubscriber' },
    'status-page-domains': { singular: 'StatusPageDomain' },
  },
  'devhelm-manage': {
    'api-keys': { singular: 'ApiKey' },
    environments: { singular: 'Environment' },
    workspaces: { singular: 'Workspace', readOnly: true },
    entitlements: { singular: 'Entitlements', readOnly: true },
  },
  'devhelm-synthetics': {
    'script-config': { schemas: ['ScriptMonitorConfig'] },
    bundles: { schemas: ['CreateBundleRequest', 'BundleDto', 'BundleCheckResultDto'] },
    revisions: {
      schemas: ['CreateDraftRevisionRequest', 'PublishRevisionRequest', 'RollbackRevisionRequest', 'RevisionDto'],
    },
    runs: { schemas: ['RunDto', 'RunStepDto', 'RunFailureDto', 'TriggerRunRequest', 'TriggerRunsResponse'] },
    'secret-requests': { schemas: ['MonitorSecretRequestsDto', 'SecretRequestDto'] },
    'runtime-profiles': { schemas: ['RuntimeProfileDto'] },
  },
};

function loadSpec() {
  const raw = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
  preprocessSpec(raw);
  return raw;
}

/**
 * Resolve `$ref` one hop. We intentionally don't deep-resolve to keep the
 * field listing flat — nested objects show as their schema name, which the
 * reader can look up in the same file or in a sibling generated file.
 */
function shortRef(ref) {
  if (!ref) return undefined;
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

/**
 * Produce a concise human-readable type expression for a property.
 * Enums get their values inline (up to 8); larger enums get summarised.
 */
function typeOf(prop) {
  if (!prop) return '?';
  if (prop.$ref) return shortRef(prop.$ref);

  if (prop.enum) {
    if (prop.enum.length <= 8) {
      return prop.enum.map((v) => JSON.stringify(v)).join(' \\| ');
    }
    return `${prop.type ?? 'string'} (${prop.enum.length} enum values — see OpenAPI spec)`;
  }

  if (prop.type === 'array') {
    const itemType = prop.items ? typeOf(prop.items) : 'any';
    return `${itemType}[]`;
  }

  if (prop.type === 'object') {
    if (prop.additionalProperties && typeof prop.additionalProperties === 'object') {
      return `Map<string, ${typeOf(prop.additionalProperties)}>`;
    }
    return 'object';
  }

  let t = prop.type ?? 'any';
  if (prop.format) t += ` (${prop.format})`;
  return t;
}

function escapePipe(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderSchemaTable(schemaName, schema) {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return `> Schema \`${schemaName}\` is not a simple object; see OpenAPI spec.\n`;
  }

  const required = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties);
  if (props.length === 0) return '> No fields.\n';

  const header =
    '| Field | Type | Required | Nullable | Description |\n' +
    '|---|---|---|---|---|';

  const rows = props.map(([name, prop]) => {
    const t = typeOf(prop);
    const req = required.has(name) ? '✓' : '';
    const nullable = prop.nullable === true ? '✓' : '';
    const desc = prop.description ? escapePipe(prop.description) : '';
    return `| \`${name}\` | ${t} | ${req} | ${nullable} | ${desc} |`;
  });

  return [header, ...rows, ''].join('\n');
}

function findSchema(spec, names) {
  const all = spec.components?.schemas ?? {};
  for (const n of names) {
    if (all[n]) return { name: n, schema: all[n] };
  }
  return null;
}

function renderResource(spec, resourceName, { singular, readOnly, schemas }) {
  const lines = [];
  lines.push(`# ${resourceName} — field reference`);
  lines.push('');
  lines.push(
    '> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.',
  );
  lines.push(
    '> Regenerate with `node scripts/generate-skill-references.mjs`.',
  );
  lines.push('');

  if (schemas) {
    // Explicit schema list for resources that don't follow Create/Update/Dto naming.
    for (const name of schemas) {
      const found = findSchema(spec, [name]);
      if (!found) throw new Error(`Schema ${name} for ${resourceName} is not in the spec`);
      lines.push(`## \`${name}\``);
      lines.push('');
      lines.push(renderSchemaTable(name, found.schema));
    }
    return lines.join('\n');
  }

  if (!readOnly) {
    const create = findSchema(spec, [`Create${singular}Request`]);
    if (create) {
      lines.push(`## \`Create${singular}Request\``);
      lines.push('');
      lines.push(renderSchemaTable(create.name, create.schema));
    }

    const update = findSchema(spec, [
      `Update${singular}Request`,
      `Patch${singular}Request`,
    ]);
    if (update) {
      lines.push(`## \`${update.name}\``);
      lines.push('');
      lines.push(renderSchemaTable(update.name, update.schema));
    }
  }

  const dto = findSchema(spec, [`${singular}Dto`, singular]);
  if (dto) {
    lines.push(`## \`${dto.name}\` (response shape)`);
    lines.push('');
    lines.push(renderSchemaTable(dto.name, dto.schema));
  }

  if (
    lines.filter((l) => l.startsWith('## ')).length === 0
  ) {
    lines.push('> No schemas found for this resource in the current spec.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Stamp `metadata.version` in every SKILL.md frontmatter with the CLI
 * version, so `devhelm doctor` can tell an installed skill from another
 * release apart. npm's `version` lifecycle runs this script, so a release
 * bump restamps the skills in the same commit.
 */
function stampVersions() {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const skill of readdirSync(join(ROOT, 'skills'))) {
    const file = join(ROOT, 'skills', skill, 'SKILL.md');
    if (!existsSync(file)) continue;
    const body = readFileSync(file, 'utf8');
    const end = body.indexOf('\n---', 4);
    if (!body.startsWith('---\n') || end === -1) throw new Error(`${file} has no frontmatter`);
    const front = body
      .slice(4, end)
      .split('\n')
      .filter((l) => l !== 'metadata:' && !/^ {2}version: /.test(l));
    front.push('metadata:', `  version: "${version}"`);
    const next = `---\n${front.join('\n')}${body.slice(end)}`;
    if (next !== body) writeFileSync(file, next, 'utf8');
  }
}

function main() {
  stampVersions();
  const spec = loadSpec();

  let total = 0;
  for (const [skill, resources] of Object.entries(RESOURCES)) {
    const outDir = join(ROOT, 'skills', skill, 'references', '_generated');
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    for (const [resource, cfg] of Object.entries(resources)) {
      const body = renderResource(spec, resource, cfg);
      const outPath = join(outDir, `${resource}.fields.md`);
      writeFileSync(outPath, body + '\n', 'utf8');
      total += 1;
    }
  }

  console.log(`Generated ${total} skill field references.`);
}

main();
