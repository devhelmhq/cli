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
 *   3. Discriminator-based polymorphic types (`@JsonTypeInfo`) emit:
 *        - parent: `{type: object, properties: {<disc>: {type: string}}, discriminator}`
 *        - subtype: `{allOf: [{$ref: parent}, {type: object, properties: {...}}]}`
 *      which downstream codegens handle inconsistently and which lose all
 *      union information at nullable use sites. Pass A inlines parent
 *      props into each subtype + overloads the discriminator field with a
 *      `string` enum literal; pass B rewrites the parent itself as a
 *      `oneOf` of subtype refs (preserving the discriminator).
 *
 *   4. Circular `oneOf` + `allOf` back-references — openapi-zod-client
 *      turns these into `z.lazy()` with broken type inference. After the
 *      discriminator inline pass these no longer exist for the inlined
 *      hierarchies, but other (non-discriminated) cycles may still occur.
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

function inlineSubtype(subtype, parent, parentName, discProp, discValue) {
  const allOf = subtype.allOf ?? [];
  let inlineMember;
  for (const m of allOf) {
    if (!isSchemaObj(m)) continue;
    inlineMember = m;
    break;
  }

  const mergedProps = {};
  if (parent.properties) Object.assign(mergedProps, parent.properties);
  if (inlineMember?.properties) Object.assign(mergedProps, inlineMember.properties);
  if (subtype.properties) Object.assign(mergedProps, subtype.properties);

  mergedProps[discProp] = { type: 'string', enum: [discValue] };

  const requiredSet = new Set();
  for (const r of parent.required ?? []) requiredSet.add(r);
  for (const r of inlineMember?.required ?? []) requiredSet.add(r);
  for (const r of subtype.required ?? []) requiredSet.add(r);
  requiredSet.add(discProp);

  const description = subtype.description ?? inlineMember?.description;

  delete subtype.allOf;
  subtype.type = 'object';
  subtype.properties = mergedProps;
  subtype.required = Array.from(requiredSet);
  if (description) subtype.description = description;

  void parentName;
}

/**
 * Inline discriminator subtypes and rewrite the parent as a `oneOf` of
 * subtype refs (with discriminator preserved). Returns metadata for each
 * rewritten hierarchy so callers can post-process generated code.
 */
export function inlineDiscriminatorSubtypesWithInfo(spec) {
  const schemas = getSchemas(spec);
  const result = [];

  for (const [parentName, parent] of Object.entries(schemas)) {
    const disc = parent.discriminator;
    if (!disc?.propertyName || !disc.mapping) continue;
    const discProp = disc.propertyName;

    const subtypeNames = new Map();
    for (const [value, ref] of Object.entries(disc.mapping)) {
      if (typeof ref !== 'string') continue;
      const name = ref.split('/').pop();
      if (name && schemas[name]) subtypeNames.set(name, value);
    }
    if (subtypeNames.size === 0) continue;

    for (const [subtypeName, discValue] of subtypeNames) {
      inlineSubtype(schemas[subtypeName], parent, parentName, discProp, discValue);
    }

    const subtypeRefs = Array.from(subtypeNames.keys()).map((name) => ({
      $ref: `#/components/schemas/${name}`,
    }));
    const description = parent.description;
    const rewritten = { oneOf: subtypeRefs, discriminator: disc };
    if (description) rewritten.description = description;

    delete parent.type;
    delete parent.properties;
    delete parent.required;
    delete parent.allOf;
    Object.assign(parent, rewritten);

    result.push({
      parent: parentName,
      discriminator: discProp,
      subtypes: Array.from(subtypeNames.keys()),
    });
  }
  return result;
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

/**
 * Rewrite `{nullable: true, allOf: [{$ref: Parent}]}` wrappers into an
 * inline `oneOf` of subtype refs, for Jackson `Id.DEDUCTION` hierarchies
 * (e.g. `MonitorConfig`) where Springdoc emits an abstract empty parent.
 *
 * Without this pass, `UpdateMonitorRequest.config` resolves to an empty
 * `z.object({})` and silently strips the entire config body.
 */
export function inlineNullableDeductionRefs(spec) {
  const schemas = getSchemas(spec);
  const rewritten = new Set();

  const abstractParents = new Set();
  for (const [name, schema] of Object.entries(schemas)) {
    const isAbstract =
      !schema.oneOf &&
      !schema.properties &&
      !schema.allOf &&
      (schema.type === 'object' || schema.type === undefined);
    if (isAbstract) abstractParents.add(name);
  }
  if (abstractParents.size === 0) return [];

  const subtypesByParent = new Map();
  for (const parent of abstractParents) {
    const parentRef = `#/components/schemas/${parent}`;
    const subs = [];
    for (const [name, schema] of Object.entries(schemas)) {
      if (name === parent) continue;
      if (!Array.isArray(schema.allOf)) continue;
      const hasBackref = schema.allOf.some(
        (m) => '$ref' in m && m.$ref === parentRef,
      );
      if (hasBackref) subs.push(name);
    }
    if (subs.length >= 2) subtypesByParent.set(parent, subs);
  }
  if (subtypesByParent.size === 0) return [];

  // Flatten each subtype: drop the `{$ref: parent}` entry so generated codegens
  // don't intersect the subtype with the empty strict parent.
  for (const [parent, subs] of subtypesByParent) {
    const parentRef = `#/components/schemas/${parent}`;
    for (const subName of subs) {
      const sub = schemas[subName];
      if (!sub || !Array.isArray(sub.allOf)) continue;
      const remaining = sub.allOf.filter(
        (m) => !('$ref' in m) || m.$ref !== parentRef,
      );
      if (remaining.length === sub.allOf.length) continue;
      if (remaining.length === 0) {
        delete sub.allOf;
      } else if (remaining.length === 1 && isSchemaObj(remaining[0])) {
        const inline = remaining[0];
        delete sub.allOf;
        if (inline.type && !sub.type) sub.type = inline.type;
        if (inline.properties) {
          sub.properties = { ...(sub.properties ?? {}), ...inline.properties };
        }
        if (Array.isArray(inline.required)) {
          const merged = new Set([
            ...(sub.required ?? []),
            ...inline.required,
          ]);
          sub.required = Array.from(merged);
        }
        if (
          inline.additionalProperties !== undefined &&
          sub.additionalProperties === undefined
        ) {
          sub.additionalProperties = inline.additionalProperties;
        }
      } else {
        sub.allOf = remaining;
      }
    }
  }

  const visit = (schema) => {
    if (!isSchemaObj(schema)) return;
    const props = schema.properties;
    if (props) {
      for (const raw of Object.values(props)) {
        if (!isSchemaObj(raw)) continue;
        if (Array.isArray(raw.allOf) && raw.allOf.length === 1) {
          const m = raw.allOf[0];
          if ('$ref' in m && typeof m.$ref === 'string') {
            const n = m.$ref.split('/').pop();
            const subs = n ? subtypesByParent.get(n) : undefined;
            if (subs && n) {
              delete raw.allOf;
              raw.oneOf = subs.map((s) => ({
                $ref: `#/components/schemas/${s}`,
              }));
              rewritten.add(n);
            }
          }
        }
        visit(raw);
      }
    }
    if (Array.isArray(schema.allOf)) for (const m of schema.allOf) visit(m);
    if (Array.isArray(schema.oneOf)) for (const m of schema.oneOf) visit(m);
    if (Array.isArray(schema.anyOf)) for (const m of schema.anyOf) visit(m);
  };
  for (const schema of Object.values(schemas)) visit(schema);

  return Array.from(rewritten);
}

export function preprocessSpec(spec) {
  setRequiredFields(spec);
  setRequiredOnAllOfMembers(spec);
  pushRequiredIntoAllOf(spec);
  // Inline discriminator subtypes BEFORE the circular-oneOf flatten so we
  // don't accidentally drop the parent oneOf we just installed (the cycle
  // is broken once subtypes no longer back-reference the parent).
  const inlinedDiscriminators = inlineDiscriminatorSubtypesWithInfo(spec);
  // Must run AFTER the discriminator pass so we don't misidentify proper
  // discriminator-based parents as abstract/empty ones.
  const inlinedNullableDeductions = inlineNullableDeductionRefs(spec);
  const flattened = flattenCircularOneOf(spec);
  return { flattened, inlinedDiscriminators, inlinedNullableDeductions };
}

/**
 * Rewrite `z.union([A, B, C])` calls into
 * `z.discriminatedUnion("<prop>", [A, B, C])` when the member set matches
 * one of the supplied unions exactly (set equality).
 */
export function rewriteUnionsAsDiscriminated(source, unions) {
  if (!unions || unions.length === 0) return source;

  const lookup = new Map();
  for (const u of unions) {
    const key = [...u.subtypes].sort().join(',');
    lookup.set(key, u.discriminator);
  }

  const unionRe =
    /z\.union\(\s*\[\s*([A-Z][A-Za-z0-9_]*(?:\s*,\s*[A-Z][A-Za-z0-9_]*)*)\s*,?\s*\]\s*\)/g;

  return source.replace(unionRe, (full, members) => {
    const memberList = members
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const key = [...memberList].sort().join(',');
    const disc = lookup.get(key);
    if (!disc) return full;
    return `z.discriminatedUnion("${disc}", [${memberList.join(', ')}])`;
  });
}
