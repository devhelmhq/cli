/**
 * Vendored OpenAPI spec preprocessing for Zod schema generation.
 *
 * Identical logic to @devhelm/openapi-tools/preprocess in the upstream
 * mono repo. Vendored here so the CLI build is self-contained and
 * doesn't depend on a sibling-checkout file: dependency that breaks CI
 * the moment it runs anywhere outside the dev workstation.
 *
 * Springdoc (the Java OpenAPI generator) has quirks that produce specs
 * incompatible with openapi-zod-client / openapi-typescript:
 *
 *   1. Missing `required` arrays on object schemas — Springdoc only
 *      populates `required` when @NotBlank/@NotNull annotations exist.
 *      Primitive `int` fields and unannotated non-nullable fields get
 *      omitted, so the codegen makes them optional (`.partial()`).
 *
 *   2. `required` at schema root while `properties` live inside `allOf` —
 *      openapi-zod-client processes each allOf member independently and
 *      generates `.partial()` for inner objects without their own
 *      `required`.
 *
 *   3. Circular `oneOf` + `allOf` back-references — openapi-zod-client
 *      turns these into `z.lazy()` with broken type inference. Only
 *      affects schemas with inheritance cycles (e.g. billing types).
 *
 * These functions mutate the spec in-place.
 */

function isSchemaObj(v) {
  return v && typeof v === 'object' && !('$ref' in v);
}

function getSchemas(spec) {
  return spec.components?.schemas ?? {};
}

export function setRequiredFields(spec) {
  const schemas = getSchemas(spec);
  for (const schema of Object.values(schemas)) {
    if (schema.type !== 'object' || !schema.properties) continue;
    const existing = Array.isArray(schema.required) ? schema.required : [];
    for (const [prop, raw] of Object.entries(schema.properties)) {
      if (!isSchemaObj(raw)) continue;
      if (raw.nullable) continue;
      if (raw.allOf) continue;
      if ('default' in raw) continue;
      if (!existing.includes(prop)) existing.push(prop);
    }
    if (existing.length > 0) schema.required = existing;
  }
}

export function setRequiredOnAllOfMembers(spec) {
  const schemas = getSchemas(spec);
  for (const schema of Object.values(schemas)) {
    if (!Array.isArray(schema.allOf)) continue;
    for (const member of schema.allOf) {
      if (!isSchemaObj(member)) continue;
      if (!member.properties) continue;
      if (Array.isArray(member.required)) continue;
      const required = [];
      for (const [prop, raw] of Object.entries(member.properties)) {
        if (!isSchemaObj(raw)) continue;
        if (raw.nullable) continue;
        if (raw.allOf) continue;
        if ('default' in raw) continue;
        required.push(prop);
      }
      if (required.length > 0) member.required = required;
    }
  }
}

export function pushRequiredIntoAllOf(spec) {
  const schemas = getSchemas(spec);
  for (const schema of Object.values(schemas)) {
    if (!Array.isArray(schema.required) || !Array.isArray(schema.allOf)) continue;
    for (const member of schema.allOf) {
      if (!isSchemaObj(member)) continue;
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

export function flattenCircularOneOf(spec) {
  const schemas = getSchemas(spec);
  const flattened = [];
  for (const [name, schema] of Object.entries(schemas)) {
    if (!Array.isArray(schema.oneOf)) continue;
    const isCircular = schema.oneOf.some((member) => {
      const ref = '$ref' in member ? member.$ref : undefined;
      const refName = ref?.split('/').pop();
      const refSchema = refName ? schemas[refName] : undefined;
      if (!refSchema || !Array.isArray(refSchema.allOf)) return false;
      return refSchema.allOf.some(
        (a) => '$ref' in a && a.$ref === `#/components/schemas/${name}`,
      );
    });
    if (isCircular) {
      delete schema.oneOf;
      flattened.push(name);
    }
  }
  return flattened;
}

export function preprocessSpec(spec) {
  setRequiredFields(spec);
  setRequiredOnAllOfMembers(spec);
  pushRequiredIntoAllOf(spec);
  const flattened = flattenCircularOneOf(spec);
  return { flattened };
}
