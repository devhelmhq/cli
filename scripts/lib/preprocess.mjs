// GENERATED FILE — DO NOT EDIT.
//
// Vendored from @devhelm/openapi-tools@0.1.0 (mono: packages/openapi-tools).
// Built by packages/openapi-tools/scripts/build-vendor.mjs from
// src/{reachability,preprocess,postprocess}.ts. To update, rebuild the
// package in mono and copy dist/vendor/preprocess.mjs over this file.

// ── reachability.ts ─────────────────────────────────────────────
/**
 * Response-vs-request reachability over `components.schemas`.
 *
 * Postel's Law (`runbooks/api-contract.md` § 2.2): surfaces decode responses
 * tolerantly and author requests strictly. Classifying schemas by name alone
 * (`*Dto`, `*Response`, `*DisplayConfig`) misses every nested type a response
 * reaches through `$ref` but whose name does not follow the convention — e.g.
 * `ErrorResponse.category → ErrorCategory` (a named enum component) and
 * `ErrorResponse.next → ErrorNext` (a nested object). A surface built against
 * today's spec would then reject a new category value or a new key under
 * `next`, and the whole error body would fail to decode.
 *
 * This module walks the spec from its operations:
 *
 *   - **response seeds** — every schema `$ref` under `paths.*.*.responses`
 *     (success and error bodies), resolving `#/components/responses/*`.
 *   - **request seeds** — every schema `$ref` under `requestBody` and
 *     `parameters` (operation-level and path-level), resolving
 *     `#/components/requestBodies/*` and `#/components/parameters/*`.
 *
 * and closes each seed set transitively over `$ref` (including
 * `discriminator.mapping` targets). A schema that is response-reachable and
 * NOT request-reachable is decoded tolerantly by every surface. A schema that
 * is request-reachable stays strict: the same generated type is the authoring
 * schema for that request, and P2 (request extras forbidden) wins.
 *
 * Sealed envelopes (`SingleValueResponse*`, `TableValueResult*`,
 * `CursorPage*`) are seeds like any other response schema, so the item DTOs
 * they carry are reached through them. Their own top-level shape is locked by
 * the published surfaces (see AGENTS.md "SDK Safety"); this module does not
 * change how they are classified — {@link isTolerantDecodeSchema} keeps the
 * existing name rule for them.
 */
export const SCHEMA_REF_PREFIX = "#/components/schemas/";
const COMPONENT_REF_RE = /^#\/components\/(responses|requestBodies|parameters)\/(.+)$/;
const HTTP_METHODS = [
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
];
/** Envelope name prefixes whose top-level shape is locked (AGENTS.md "SDK Safety"). */
export const SEALED_ENVELOPE_PREFIXES = [
    "SingleValueResponse",
    "TableValueResult",
    "CursorPage",
];
export function isSealedEnvelopeName(name) {
    return SEALED_ENVELOPE_PREFIXES.some((p) => name.startsWith(p));
}
/**
 * Name-based classification shared by every pass. Response-shape names are
 * tolerant even when no operation reaches them (exported helper types, specs
 * without `paths` in unit fixtures). Request-shape names are never tolerant.
 */
export function isResponseShapeName(name) {
    if (/^[a-z]/.test(name))
        return false;
    if (/(Request|Params)$/.test(name))
        return false;
    return (/(Dto|Response|DisplayConfig)$/.test(name) ||
        SEALED_ENVELOPE_PREFIXES.some((p) => name.startsWith(p)));
}
/** Names that must stay strict regardless of reachability. */
export function isRequestShapeName(name) {
    return /^[a-z]/.test(name) || /(Request|Params)$/.test(name);
}
function schemaRefName(ref) {
    return ref.startsWith(SCHEMA_REF_PREFIX)
        ? ref.slice(SCHEMA_REF_PREFIX.length)
        : undefined;
}
/**
 * Collect every schema name referenced inside `node`. Component refs to
 * responses / requestBodies / parameters are followed (once each) so shared
 * error responses declared under `components.responses` still seed.
 */
function collectSchemaRefs(spec, node, out, seenComponents = new Set()) {
    if (Array.isArray(node)) {
        for (const v of node)
            collectSchemaRefs(spec, v, out, seenComponents);
        return;
    }
    if (!node || typeof node !== "object")
        return;
    const obj = node;
    for (const [key, value] of Object.entries(obj)) {
        if (key === "$ref" && typeof value === "string") {
            const name = schemaRefName(value);
            if (name) {
                out.add(name);
                continue;
            }
            const m = COMPONENT_REF_RE.exec(value);
            if (m && !seenComponents.has(value)) {
                seenComponents.add(value);
                const bucket = spec.components?.[m[1]];
                collectSchemaRefs(spec, bucket?.[m[2]], out, seenComponents);
            }
            continue;
        }
        if (key === "mapping" && value && typeof value === "object") {
            for (const target of Object.values(value)) {
                if (typeof target !== "string")
                    continue;
                const name = schemaRefName(target);
                if (name)
                    out.add(name);
            }
            continue;
        }
        collectSchemaRefs(spec, value, out, seenComponents);
    }
}
function closeOver(spec, seeds) {
    const schemas = (spec.components?.schemas ?? {});
    const seen = new Set();
    const stack = [...seeds];
    while (stack.length > 0) {
        const name = stack.pop();
        if (seen.has(name) || !(name in schemas))
            continue;
        seen.add(name);
        const refs = new Set();
        collectSchemaRefs(spec, schemas[name], refs);
        for (const r of refs)
            if (!seen.has(r))
                stack.push(r);
    }
    return seen;
}
/** Compute response / request reachability for every component schema. */
export function computeSchemaReachability(spec) {
    const responseSeeds = new Set();
    const requestSeeds = new Set();
    for (const pathItem of Object.values(spec.paths ?? {})) {
        if (!pathItem || typeof pathItem !== "object")
            continue;
        const item = pathItem;
        collectSchemaRefs(spec, item.parameters, requestSeeds);
        for (const method of HTTP_METHODS) {
            const op = item[method];
            if (!op || typeof op !== "object")
                continue;
            collectSchemaRefs(spec, op.responses, responseSeeds);
            collectSchemaRefs(spec, op.requestBody, requestSeeds);
            collectSchemaRefs(spec, op.parameters, requestSeeds);
        }
    }
    const response = closeOver(spec, responseSeeds);
    const request = closeOver(spec, requestSeeds);
    const responseOnly = new Set();
    for (const name of response) {
        if (request.has(name))
            continue;
        if (isRequestShapeName(name))
            continue;
        responseOnly.add(name);
    }
    return { response, request, responseOnly };
}
/**
 * Names of every schema surfaces must decode tolerantly: the name rule
 * ({@link isResponseShapeName}) plus every response-only schema.
 */
export function tolerantSchemaNames(spec) {
    const out = new Set();
    for (const name of Object.keys(spec.components?.schemas ?? {})) {
        if (isResponseShapeName(name))
            out.add(name);
    }
    for (const name of computeSchemaReachability(spec).responseOnly) {
        out.add(name);
    }
    return out;
}
/**
 * Classify one schema name. With `tolerant` (from {@link tolerantSchemaNames})
 * reachability decides; without it only the name rule applies.
 */
export function isTolerantDecodeSchema(name, tolerant) {
    if (isResponseShapeName(name))
        return true;
    if (!tolerant)
        return false;
    return tolerant.has(name) && !isRequestShapeName(name);
}

// ── preprocess.ts ───────────────────────────────────────────────
/**
 * Shared OpenAPI spec preprocessing for Zod schema generation.
 *
 * Springdoc (the Java OpenAPI generator) has quirks that produce specs
 * incompatible with openapi-zod-client:
 *
 *   1. Missing `required` arrays on object schemas — Springdoc only populates
 *      `required` when @NotBlank/@NotNull annotations exist. Primitive `int`
 *      fields and unannotated non-nullable fields get omitted, so the codegen
 *      makes them optional (.partial()).
 *
 *   2. `required` at schema root while `properties` live inside `allOf` —
 *      openapi-zod-client processes each allOf member independently and
 *      generates .partial() for inner objects without their own `required`.
 *
 *   3. Circular `oneOf` + `allOf` back-references — openapi-zod-client turns
 *      these into `z.lazy()` with broken type inference. Only affects schemas
 *      with inheritance cycles (e.g. billing types).
 *
 * These functions mutate the spec in-place.
 */

function isSchemaObj(v) {
    return !("$ref" in v);
}
function getSchemas(spec) {
    return (spec.components?.schemas ?? {});
}
/**
 * Populate `required` arrays on object schemas that Springdoc left empty.
 *
 * Springdoc only adds fields to `required` when they have @NotBlank/@NotNull.
 * Many non-nullable fields (primitives, unannotated types) are omitted. This
 * function adds all non-nullable, non-allOf, non-default fields — both when
 * `required` is missing AND when it already exists but is incomplete.
 */
export function setRequiredFields(spec) {
    const schemas = getSchemas(spec);
    for (const schema of Object.values(schemas)) {
        if (schema.type !== "object" || !schema.properties)
            continue;
        const existing = Array.isArray(schema.required) ? schema.required : [];
        for (const [prop, raw] of Object.entries(schema.properties)) {
            if (!isSchemaObj(raw))
                continue;
            if (raw.nullable)
                continue;
            if (raw.allOf)
                continue;
            if ("default" in raw)
                continue;
            if (!existing.includes(prop)) {
                existing.push(prop);
            }
        }
        if (existing.length > 0) {
            schema.required = existing;
        }
    }
}
/**
 * Set `required` on inline `allOf` member schemas that Springdoc left empty.
 *
 * Many polymorphic schemas (e.g. assertion configs) are composed via allOf:
 *   allOf: [{ $ref: BaseSchema }, { type: "object", properties: { maxMs: ... } }]
 *
 * The inline member has properties but no `required` array, and the parent
 * schema also lacks `required`. `setRequiredFields` doesn't reach these
 * because it only processes top-level schemas with direct `properties`.
 *
 * This pass iterates allOf members and applies the same non-nullable →
 * required logic.
 */
export function setRequiredOnAllOfMembers(spec) {
    const schemas = getSchemas(spec);
    for (const schema of Object.values(schemas)) {
        if (!Array.isArray(schema.allOf))
            continue;
        for (const rawMember of schema.allOf) {
            if (!isSchemaObj(rawMember))
                continue;
            const member = rawMember;
            if (!member.properties)
                continue;
            if (Array.isArray(member.required))
                continue;
            const required = [];
            for (const [prop, raw] of Object.entries(member.properties)) {
                if (!isSchemaObj(raw))
                    continue;
                if (raw.nullable)
                    continue;
                if (raw.allOf)
                    continue;
                if ("default" in raw)
                    continue;
                required.push(prop);
            }
            if (required.length > 0) {
                member.required = required;
            }
        }
    }
}
/**
 * Push top-level `required` into `allOf` inner schemas.
 *
 * Springdoc puts `required` at the schema root even when properties live
 * inside an `allOf` composition. openapi-zod-client processes each allOf
 * member independently and generates .partial() for inner objects that
 * lack their own `required` array.
 */
export function pushRequiredIntoAllOf(spec) {
    const schemas = getSchemas(spec);
    for (const schema of Object.values(schemas)) {
        if (!Array.isArray(schema.required) || !Array.isArray(schema.allOf))
            continue;
        for (const rawMember of schema.allOf) {
            if (!isSchemaObj(rawMember))
                continue;
            const member = rawMember;
            if (!member.properties)
                continue;
            const memberRequired = [];
            for (const field of schema.required) {
                if (field in member.properties) {
                    memberRequired.push(field);
                }
            }
            if (memberRequired.length > 0) {
                member.required = member.required
                    ? [...new Set([...member.required, ...memberRequired])]
                    : memberRequired;
            }
        }
    }
}
/**
 * Inline discriminator-based polymorphic hierarchies into self-contained
 * subtype schemas + a `oneOf` parent.
 *
 * Springdoc emits Jackson `@JsonTypeInfo` hierarchies as:
 *
 *   - Parent: `{type: "object", properties: {<disc>: {type: "string"}},
 *             discriminator: {propertyName: "<disc>", mapping: {...}}}`
 *   - Subtype: `{allOf: [{$ref: parent}, {type: "object", properties: {...}}]}`
 *   - Property usage: required ⇒ inlined `oneOf` of subtype refs;
 *                     nullable ⇒ `{nullable: true, allOf: [{$ref: parent}]}`
 *                     (which resolves to the useless `{type: string}` parent)
 *
 * Three problems result downstream:
 *
 *   1. Subtype schemas are `allOf` intersections, which `openapi-zod-client`
 *      turns into `Parent.and(Z)` — `z.infer` collapses every field to
 *      `unknown`, and the result is not a `ZodObject` so it cannot be used
 *      with `z.discriminatedUnion`. (Pydantic and oapi-codegen handle the
 *      inheritance, but still emit `type: str` instead of `Literal["..."]`.)
 *
 *   2. The discriminator field on each subtype is a generic `string`, so
 *      Zod and Pydantic union resolution falls back to "try every member,
 *      keep first success" — slow, error-noisy, and outright wrong when two
 *      subtypes share field shapes (e.g. `BearerAuthConfig`/`BasicAuthConfig`
 *      are both `{vaultSecretId}` so they're indistinguishable without a
 *      literal discriminator).
 *
 *   3. Nullable references to the parent (`MonitorDto.auth`, etc.) resolve
 *      to the `{type: string}` standalone — the entire union shape is lost
 *      at the use site even though Springdoc inlines `oneOf` correctly for
 *      required references like `UpdateMonitorAuthRequest.config`.
 *
 * This pass rewrites every subtype to be a plain object with the parent's
 * properties merged in and the discriminator field overloaded with a literal
 * `enum`. It then rewrites the parent itself to be `oneOf: [refs to subtypes]`
 * with the discriminator preserved. After the pass, downstream codegens
 * receive uniformly correct discriminated-union schemas.
 *
 * Must run AFTER {@link setRequiredFields}, {@link setRequiredOnAllOfMembers},
 * {@link pushRequiredIntoAllOf} (so subtype required arrays are already
 * normalized) and BEFORE {@link flattenCircularOneOf} (which is a no-op once
 * subtypes no longer back-reference the parent — the cycle is broken here).
 *
 * The implementation lives in {@link inlineDiscriminatorSubtypesWithInfo}
 * (defined further down) which also returns rich metadata — discriminator
 * field name, subtype names — that downstream codegen post-processors use
 * to e.g. swap `z.union` for `z.discriminatedUnion`. The simpler
 * {@link inlineDiscriminatorSubtypes} wrapper is kept for callers that
 * only need the parent name list.
 */
/**
 * Helper: rewrite a subtype schema in place by merging parent properties,
 * overloading the discriminator with a literal enum, and dropping the `allOf`
 * wrapper.
 */
function inlineSubtype(subtype, parent, parentName, discProp, discValue) {
    // Locate the inline allOf member that carries this subtype's own properties.
    // (The other allOf member is the `{$ref: parent}` reference, which we drop.)
    const allOf = subtype.allOf ?? [];
    let inlineMember;
    for (const m of allOf) {
        if (!isSchemaObj(m))
            continue;
        inlineMember = m;
        break;
    }
    // Merge: parent.properties + inline.properties + discriminator literal.
    const mergedProps = {};
    if (parent.properties)
        Object.assign(mergedProps, parent.properties);
    if (inlineMember?.properties)
        Object.assign(mergedProps, inlineMember.properties);
    if (subtype.properties)
        Object.assign(mergedProps, subtype.properties);
    // Overload the discriminator field with a literal enum so codegens emit
    // `Literal["..."]` (Pydantic), `z.literal("...")` (Zod), and so on.
    mergedProps[discProp] = {
        type: "string",
        enum: [discValue],
    };
    // Merge required arrays: parent + inline + subtype root, plus discriminator.
    const requiredSet = new Set();
    for (const r of parent.required ?? [])
        requiredSet.add(r);
    for (const r of inlineMember?.required ?? [])
        requiredSet.add(r);
    for (const r of subtype.required ?? [])
        requiredSet.add(r);
    requiredSet.add(discProp);
    // Preserve description if subtype has one; otherwise keep nothing (the
    // class-level @Schema description on parent is not relevant for subtypes).
    const description = subtype.description ?? inlineMember?.description;
    // Mutate in place.
    delete subtype.allOf;
    subtype.type = "object";
    subtype.properties = mergedProps;
    subtype.required = Array.from(requiredSet);
    if (description)
        subtype.description = description;
    // Touch parentName to satisfy lint (we kept it in the signature for future
    // diagnostics / debug logging without changing the call site).
    void parentName;
}
/**
 * Strip `oneOf` from schemas whose subtypes reference back via `allOf`.
 *
 * openapi-zod-client turns `oneOf` + circular `allOf` inheritance into
 * `z.lazy()` with recursive TypeScript types, which breaks `z.infer` on
 * any containing schema. After stripping, the base schema reverts to a
 * plain `{ type: "object" }` (generates `z.object({}).passthrough()`).
 *
 * Only needed when the spec contains circular type hierarchies (e.g.
 * billing/subscription types). The filtered public spec typically has
 * none, making this a no-op.
 */
export function flattenCircularOneOf(spec) {
    const schemas = getSchemas(spec);
    const flattened = [];
    for (const [name, schema] of Object.entries(schemas)) {
        if (!Array.isArray(schema.oneOf))
            continue;
        const isCircular = schema.oneOf.some((member) => {
            const ref = "$ref" in member ? member.$ref : undefined;
            const refName = ref?.split("/").pop();
            const refSchema = refName ? schemas[refName] : undefined;
            if (!refSchema || !Array.isArray(refSchema.allOf))
                return false;
            return refSchema.allOf.some((a) => "$ref" in a &&
                a.$ref === `#/components/schemas/${name}`);
        });
        if (isCircular) {
            delete schema.oneOf;
            flattened.push(name);
        }
    }
    return flattened;
}
/**
 * Rewrite `{nullable: true, allOf: [{$ref: X}]}` wrappers into the same inline
 * `oneOf` that Springdoc emits for non-nullable references to deduction-based
 * polymorphic types (Jackson `Id.DEDUCTION`, e.g. `MonitorConfig`).
 *
 * For deduction-based hierarchies, Springdoc has two output modes for a given
 * property that references the abstract parent:
 *
 *   - `@NotNull` / required → inline `oneOf: [$ref: SubA, $ref: SubB, ...]`
 *   - `@Nullable`           → `{nullable: true, allOf: [{$ref: Parent}]}`
 *
 * When the parent component schema itself has no `oneOf` (because the hierarchy
 * is resolved by shape rather than a discriminator field), the second form
 * resolves to an empty object in every downstream codegen — zod, Pydantic, Go
 * types all silently strip the subtype-specific fields. The dashboard issues a
 * PUT /monitors/:id with `{config: {host, port}}` and the schema-level parse
 * strips the config body to `{}` because `MonitorConfig.nullable()` accepts no
 * properties.
 *
 * We fix this at preprocess time by harvesting the subtype refs from the first
 * form (inline `oneOf`) and replacing the second form (`allOf` wrap) with the
 * same `oneOf`. We preserve `nullable: true` so codegens still wrap the union
 * in a `.nullable()` / `Optional[...]` / `*T` as appropriate.
 *
 * Guards:
 *   - Only rewrites refs to components that have NO `oneOf` of their own (the
 *     proper polymorphic case is already handled by
 *     {@link inlineDiscriminatorSubtypesWithInfo}).
 *   - Only rewrites when we can find at least one sibling inline `oneOf` that
 *     references the same parent. Without that evidence we don't know the
 *     subtype list, so we leave the wrapper alone.
 *   - Uses the LARGEST observed inline oneOf (union of all subtype refs) to
 *     handle APIs that emit partial subtype lists at different call sites.
 */
export function inlineNullableDeductionRefs(spec) {
    const schemas = getSchemas(spec);
    const rewritten = new Set();
    // 1. Find every "abstract" component — a bare object with no properties,
    //    no oneOf, no allOf. Those are the empty parents Springdoc emits for
    //    Jackson `Id.DEDUCTION` hierarchies (no discriminator field, so no
    //    discriminatorMapping, so {@link inlineDiscriminatorSubtypesWithInfo}
    //    can't handle them).
    const abstractParents = new Set();
    for (const [name, schema] of Object.entries(schemas)) {
        const isAbstract = !schema.oneOf &&
            !schema.properties &&
            !schema.allOf &&
            (schema.type === "object" || schema.type === undefined);
        if (isAbstract)
            abstractParents.add(name);
    }
    if (abstractParents.size === 0)
        return [];
    // 2. For each abstract parent, enumerate its subtypes by scanning components
    //    for `allOf: […, {$ref: parent}, …]` back-references. Jackson subtypes
    //    always carry this ref because `sealed interface Parent permits Subtype`
    //    in Java emits the inheritance in the subtype's allOf.
    const subtypesByParent = new Map();
    for (const parent of abstractParents) {
        const parentRef = `#/components/schemas/${parent}`;
        const subs = [];
        for (const [name, schema] of Object.entries(schemas)) {
            if (name === parent)
                continue;
            if (!Array.isArray(schema.allOf))
                continue;
            const hasBackref = schema.allOf.some((m) => "$ref" in m && m.$ref === parentRef);
            if (hasBackref)
                subs.push(name);
        }
        if (subs.length >= 2)
            subtypesByParent.set(parent, subs);
    }
    if (subtypesByParent.size === 0)
        return [];
    // 3. Flatten each subtype: drop the `{$ref: parent}` entry from its allOf
    //    list, collapsing the subtype into a plain object. This breaks the
    //    inheritance link Springdoc emitted — the parent schema was already
    //    empty (no real fields), so its only contribution to the subtype was
    //    the back-reference itself. Leaving it in would cause the generated
    //    codegen (e.g. `SubA = Parent.and(z.object({...}))`) to pick up the
    //    empty `.strict()` parent and reject any of the subtype's own keys.
    for (const [parent, subs] of subtypesByParent) {
        const parentRef = `#/components/schemas/${parent}`;
        for (const subName of subs) {
            const sub = schemas[subName];
            if (!sub || !Array.isArray(sub.allOf))
                continue;
            const remaining = sub.allOf.filter((m) => !("$ref" in m) || m.$ref !== parentRef);
            if (remaining.length === sub.allOf.length)
                continue;
            if (remaining.length === 0) {
                delete sub.allOf;
            }
            else if (remaining.length === 1 && isSchemaObj(remaining[0])) {
                // Collapse the single remaining inline member up onto the subtype.
                const inline = remaining[0];
                delete sub.allOf;
                if (inline.type && !sub.type)
                    sub.type = inline.type;
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
                if (inline.additionalProperties !== undefined &&
                    sub.additionalProperties === undefined) {
                    sub.additionalProperties = inline.additionalProperties;
                }
            }
            else {
                sub.allOf = remaining;
            }
        }
    }
    // 4. Rewrite every property-level `allOf: [{$ref: parent}]` wrapper to an
    //    inline `oneOf` of subtype refs. Preserve sibling `nullable` /
    //    `description`. We walk all schemas recursively so nested usages in
    //    allOf members / oneOf members are also caught.
    const visit = (schema) => {
        if (!isSchemaObj(schema))
            return;
        const props = schema.properties;
        if (props) {
            for (const raw of Object.values(props)) {
                if (!isSchemaObj(raw))
                    continue;
                if (Array.isArray(raw.allOf) && raw.allOf.length === 1) {
                    const m = raw.allOf[0];
                    if ("$ref" in m && typeof m.$ref === "string") {
                        const n = m.$ref.split("/").pop();
                        const subs = n ? subtypesByParent.get(n) : undefined;
                        if (subs && n) {
                            const wrapper = raw;
                            delete wrapper.allOf;
                            wrapper.oneOf = subs.map((s) => ({
                                $ref: `#/components/schemas/${s}`,
                            }));
                            rewritten.add(n);
                        }
                    }
                }
                visit(raw);
            }
        }
        if (Array.isArray(schema.allOf))
            for (const m of schema.allOf)
                visit(m);
        if (Array.isArray(schema.oneOf))
            for (const m of schema.oneOf)
                visit(m);
        if (Array.isArray(schema.anyOf))
            for (const m of schema.anyOf)
                visit(m);
    };
    for (const schema of Object.values(schemas))
        visit(schema);
    return Array.from(rewritten);
}
/**
 * Inline discriminator subtypes and collect rich metadata about each
 * rewritten hierarchy so downstream codegens can post-process the generated
 * code (e.g. swap `z.union` for `z.discriminatedUnion`).
 */
export function inlineDiscriminatorSubtypesWithInfo(spec) {
    const schemas = getSchemas(spec);
    const result = [];
    for (const [parentName, parent] of Object.entries(schemas)) {
        const disc = parent.discriminator;
        if (!disc?.propertyName || !disc.mapping)
            continue;
        const discProp = disc.propertyName;
        const subtypeNames = new Map();
        for (const [value, ref] of Object.entries(disc.mapping)) {
            if (typeof ref !== "string")
                continue;
            const name = ref.split("/").pop();
            if (name && schemas[name]) {
                subtypeNames.set(name, value);
            }
        }
        if (subtypeNames.size === 0)
            continue;
        for (const [subtypeName, discValue] of subtypeNames) {
            inlineSubtype(schemas[subtypeName], parent, parentName, discProp, discValue);
        }
        const subtypeRefs = Array.from(subtypeNames.keys()).map((name) => ({
            $ref: `#/components/schemas/${name}`,
        }));
        const description = parent.description;
        const rewritten = {
            oneOf: subtypeRefs,
            discriminator: disc,
        };
        if (description)
            rewritten.description = description;
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
/**
 * Drop `enum` constraints from every schema surfaces decode tolerantly, so
 * unknown future enum values pass through every downstream codegen (Zod,
 * Pydantic, Go) as plain strings. Implements the Postel's-Law contract from
 * `runbooks/api-contract.md` § 2.2 + § 3 — strict on requests, tolerant on
 * responses — at the spec layer so all surfaces inherit it uniformly.
 *
 * Selection rules:
 *
 *   - A schema is tolerant when its name is response-shape (`*Dto`,
 *     `*Response`, `*DisplayConfig`, `SingleValueResponse*`,
 *     `TableValueResult*`, `CursorPage*`) OR it is reachable through `$ref`
 *     from an operation response and not from any request body / parameter
 *     (see {@link computeSchemaReachability}). `*Request` / `*Params` and
 *     lower-case helper names are never tolerant.
 *   - Inside a tolerant object schema, every multi-value `enum` (length ≥ 2)
 *     on a property — and on nested inline schemas (`items`,
 *     `additionalProperties`, inline `allOf` / `oneOf` / `anyOf` members,
 *     inline object properties) — is dropped so codegens emit `z.string()` /
 *     `str` / `string`.
 *   - A tolerant top-level enum component (e.g. `ErrorCategory`, reached only
 *     from `ErrorResponse`) loses its `enum` and becomes a plain string.
 *   - A property in a tolerant schema that references a named enum component
 *     still reachable from requests (so it must stay strict for authoring) is
 *     rewritten in place to an inline `{type: "string"}` — the request side
 *     keeps the closed enum, the response side decodes any value.
 *   - SINGLE-VALUE enums (`enum: ["X"]`) are PRESERVED — those are the
 *     discriminator tags installed by `inlineDiscriminatorSubtypesWithInfo`,
 *     and Pydantic's discriminated-union validator requires `Literal["X"]`
 *     to route. Removing them would break sealed-union dispatch.
 *
 * Returns the list of relaxed paths (`Schema.field`, `Schema.field[]`,
 * `Schema` for a whole enum component) for logging + tests.
 *
 * Idempotent: re-running on an already-relaxed spec is a no-op.
 */
export function relaxResponseEnumsInSpec(spec) {
    const schemas = getSchemas(spec);
    const relaxed = [];
    const tolerant = tolerantSchemaNames(spec);
    function isMultiEnum(s) {
        return !!s && isSchemaObj(s) && Array.isArray(s.enum) && s.enum.length >= 2;
    }
    /** Name of a strict (request-reachable) multi-value enum component `s` points at. */
    function strictEnumRef(s) {
        if (!s)
            return undefined;
        let ref;
        if (!isSchemaObj(s)) {
            ref = s.$ref;
        }
        else if (Array.isArray(s.allOf) && s.allOf.length === 1) {
            const only = s.allOf[0];
            if (!isSchemaObj(only))
                ref = only.$ref;
        }
        const name = ref?.startsWith(SCHEMA_REF_PREFIX)
            ? ref.slice(SCHEMA_REF_PREFIX.length)
            : undefined;
        if (!name || tolerant.has(name))
            return undefined;
        return isMultiEnum(schemas[name]) ? name : undefined;
    }
    /** Inline replacement for a ref to a strict enum component. */
    function inlineStringFor(site, enumName) {
        const target = schemas[enumName];
        const out = { type: "string" };
        const siteObj = isSchemaObj(site) ? site : undefined;
        const description = siteObj?.description ?? target.description;
        if (description)
            out.description = description;
        if (siteObj?.nullable || target.nullable)
            out.nullable = true;
        if (siteObj?.example !== undefined)
            out.example = siteObj.example;
        return out;
    }
    /**
     * Relax one schema node in place. `path` is used for reporting; `slot`
     * writes a replacement back into the parent when a ref must be inlined.
     */
    function relaxNode(node, path, slot) {
        if (!node)
            return;
        const enumRef = strictEnumRef(node);
        if (enumRef && slot) {
            slot(inlineStringFor(node, enumRef));
            relaxed.push(path);
            return;
        }
        if (!isSchemaObj(node))
            return;
        if (isMultiEnum(node)) {
            delete node.enum;
            relaxed.push(path);
        }
        if (node.items) {
            relaxNode(node.items, `${path}[]`, (next) => {
                node.items = next;
            });
        }
        if (node.additionalProperties &&
            typeof node.additionalProperties === "object") {
            relaxNode(node.additionalProperties, `${path}{}`, (next) => {
                node.additionalProperties = next;
            });
        }
        relaxProps(path, node.properties);
        for (const key of ["allOf", "oneOf", "anyOf"]) {
            const members = node[key];
            if (!Array.isArray(members))
                continue;
            members.forEach((m, idx) => {
                // Inline members are walked; named object members are relaxed (or
                // kept strict) on their own merits. A named strict enum inside a
                // union is inlined so the response side decodes any value.
                if (isSchemaObj(m)) {
                    relaxNode(m, path, undefined);
                    return;
                }
                if (key === "allOf")
                    return;
                const enumName = strictEnumRef(m);
                if (enumName) {
                    members[idx] = inlineStringFor(m, enumName);
                    relaxed.push(path);
                }
            });
        }
    }
    function relaxProps(prefix, properties) {
        if (!properties)
            return;
        for (const [propName, raw] of Object.entries(properties)) {
            relaxNode(raw, `${prefix}.${propName}`, (next) => {
                properties[propName] = next;
            });
        }
    }
    for (const [schemaName, schema] of Object.entries(schemas)) {
        if (!tolerant.has(schemaName))
            continue;
        if (isMultiEnum(schema)) {
            // Whole enum component reached only from responses.
            delete schema.enum;
            relaxed.push(schemaName);
            continue;
        }
        relaxProps(schemaName, schema.properties);
        if (Array.isArray(schema.allOf)) {
            for (const member of schema.allOf) {
                if (isSchemaObj(member))
                    relaxProps(schemaName, member.properties);
            }
        }
        if (schema.items) {
            relaxNode(schema.items, `${schemaName}[]`, (next) => {
                schema.items = next;
            });
        }
        if (schema.additionalProperties &&
            typeof schema.additionalProperties === "object") {
            relaxNode(schema.additionalProperties, `${schemaName}{}`, (next) => {
                schema.additionalProperties = next;
            });
        }
    }
    return relaxed;
}
/**
 * Apply all preprocessing steps in the correct order.
 *
 * Returns:
 *   - `flattened`: schemas where circular `oneOf` was stripped (degenerate case).
 *   - `inlinedDiscriminators`: rich metadata about every polymorphic hierarchy
 *     that was rewritten — used by the Zod post-process to generate
 *     `z.discriminatedUnion` calls.
 *   - `inlinedNullableDeductions`: `*OrNull` ref shapes inlined back into
 *     their referent so codegens emit a single nullable schema instead of
 *     a degenerate union.
 *   - `relaxedEnums`: list of `Schema.field` paths whose multi-value enum
 *     was dropped so the surface decodes unknown future values as strings
 *     (Postel's Law contract — see `runbooks/api-contract.md`). Empty
 *     when `options.relaxResponseEnums === false`.
 *   - `tolerantSchemas`: every schema name surfaces must decode tolerantly
 *     (response-shape names + schemas reachable only from responses). Pass
 *     it to `relaxResponseStrict` / `relaxResponseEnums` when post-processing
 *     generated Zod so nested response-only objects get `.passthrough()`.
 *     Computed regardless of `relaxResponseEnums`.
 */
export function preprocessSpec(spec, options = {}) {
    const { relaxResponseEnums = true } = options;
    setRequiredFields(spec);
    setRequiredOnAllOfMembers(spec);
    pushRequiredIntoAllOf(spec);
    // Run BEFORE flattenCircularOneOf because the inline-subtype pass breaks
    // the allOf back-references that flattenCircularOneOf would otherwise
    // treat as a cycle and silently strip the parent oneOf we just installed.
    const inlinedDiscriminators = inlineDiscriminatorSubtypesWithInfo(spec);
    // Must run AFTER inlineDiscriminatorSubtypesWithInfo so we don't mistake a
    // proper discriminator-based parent for an "abstract empty" one.
    const inlinedNullableDeductions = inlineNullableDeductionRefs(spec);
    const flattened = flattenCircularOneOf(spec);
    // Postel's Law: drop multi-value enums on response-shape DTOs so all
    // codegens (Zod, Pydantic, Go) emit tolerant readers. Must run AFTER
    // discriminator inlining so we don't accidentally relax single-value
    // discriminator tags (those are length-1 enums and skipped by design).
    const relaxedEnums = relaxResponseEnums ? relaxResponseEnumsInSpec(spec) : [];
    const tolerantSchemas = Array.from(tolerantSchemaNames(spec)).sort();
    return {
        flattened,
        inlinedDiscriminators,
        inlinedNullableDeductions,
        relaxedEnums,
        tolerantSchemas,
    };
}
/**
 * Convenience wrapper kept for callers that only care about which parents
 * were rewritten, without the discriminator/subtype detail.
 *
 * @deprecated Prefer {@link inlineDiscriminatorSubtypesWithInfo} when you
 * need the discriminator metadata for post-processing generated code.
 */
export function inlineDiscriminatorSubtypes(spec) {
    return inlineDiscriminatorSubtypesWithInfo(spec).map((u) => u.parent);
}

// ── postprocess.ts ──────────────────────────────────────────────
/**
 * Pure post-processors over generated Zod source + spec metadata helpers.
 *
 * Kept free of `openapi-zod-client` / `node:fs` imports so the vendored
 * single-file bundle (`dist/vendor/preprocess.mjs`, built by
 * `scripts/build-vendor.mjs`) that surface repos copy can include them.
 */

/**
 * Derive discriminated-union metadata from a spec that has already been
 * processed by {@link preprocessSpec} (so every rewritten parent carries
 * both `oneOf` and `discriminator`). Idempotent; safe to call repeatedly.
 */
export function extractDiscriminatedUnions(spec) {
    const schemas = (spec.components?.schemas ?? {});
    const result = [];
    for (const [parent, schema] of Object.entries(schemas)) {
        const discProp = schema.discriminator?.propertyName;
        if (!discProp || !schema.oneOf)
            continue;
        const subtypes = [];
        for (const ref of schema.oneOf) {
            if (typeof ref?.$ref === "string") {
                const name = ref.$ref.split("/").pop();
                if (name)
                    subtypes.push(name);
            }
        }
        if (subtypes.length > 0) {
            result.push({ parent, discriminator: discProp, subtypes });
        }
    }
    return result;
}
/**
 * Rewrite enum literals on response-DTO schemas from `z.enum([...])` to
 * `z.string()` so a surface built today can decode an API response
 * containing a value the spec doesn't (yet) name.
 *
 * Selection rules (matches `runbooks/api-contract.md` § 2.2 and § 3.1):
 *
 *   - Walk top-level `const Name = ...` declarations in the generated file.
 *   - A declaration is "response-shape" if its name matches one of:
 *       *Dto, *Response, SingleValueResponse*, TableValueResult*, CursorPage*
 *   - A declaration is "request-shape" (and therefore left alone) if its
 *     name matches *Request, *Params, or starts lower-case (`pageable`,
 *     `paginationParams`).
 *   - Inside a response-shape declaration, every inline `z.enum([...])`
 *     gets rewritten to `z.string()`. The literal values are dropped on
 *     purpose — the schema is documentation; the canonical values are
 *     either re-exported as a hand-written const tuple in the consumer's
 *     bridge file, or pulled from `spec-facts.generated.ts` (CLI).
 *
 * The rewrite is intentionally regex-based, not AST-based:
 *   - openapi-zod-client emits a stable, regex-friendly form
 *     (`identifier: z.enum(["A", "B", "C"])`).
 *   - Enum value literals never contain `]` so a non-greedy bracket scan
 *     is safe.
 *   - An AST pass would force a full TypeScript parser dependency on
 *     `@devhelm/openapi-tools` for one cosmetic pass.
 *
 * The function is exported so per-surface generators (cli, sdk-js) that
 * don't import `generateZodSchemas` directly can apply the same pass.
 */
export function relaxResponseEnums(source, tolerant) {
    const tolerantSet = tolerant ? new Set(tolerant) : undefined;
    // Match a response-shape const declaration's name in the source. We
    // iterate top-level `^const NAME` lines because openapi-zod-client emits
    // exactly one declaration per identifier at column 0.
    const declRe = /^const\s+(\w+)\b/gm;
    const enumRe = /z\.enum\(\s*\[[^\]]*\]\s*\)/g;
    function isResponseShape(name) {
        return isTolerantDecodeSchema(name, tolerantSet);
    }
    // Collect [start, end, name] for every top-level declaration. Walking
    // sequentially gives us the boundary between one declaration and the
    // next; the body of declaration N is `[start_N, start_{N+1})`.
    const declarations = [];
    let match;
    while ((match = declRe.exec(source)) !== null) {
        declarations.push({ start: match.index, name: match[1] });
    }
    if (declarations.length === 0)
        return source;
    let out = source.slice(0, declarations[0].start);
    for (let i = 0; i < declarations.length; i++) {
        const { start, name } = declarations[i];
        const end = i + 1 < declarations.length ? declarations[i + 1].start : source.length;
        const body = source.slice(start, end);
        if (isResponseShape(name)) {
            out += body.replace(enumRe, "z.string()");
        }
        else {
            out += body;
        }
    }
    return out;
}
/**
 * Rewrite `.strict()` → `.passthrough()` on response-shape DTO declarations
 * so surfaces tolerate new fields added to the API after the surface was built.
 *
 * Uses the same response-vs-request classification as {@link relaxResponseEnums}:
 * pass `tolerant` (from `tolerantSchemaNames` / `preprocessSpec().tolerantSchemas`)
 * so every schema reachable only from responses — not just `*Dto`-named ones —
 * is relaxed. Without it only the name rule applies.
 * Request-shape schemas (`*Request`, `*Params`) keep `.strict()` to catch
 * typos in user-authored payloads. Config subtypes used in discriminated unions
 * also keep `.strict()` — they live inside request schemas, never at the top
 * level as `*Dto`/`*Response`. Nested response metadata (`*DisplayConfig`) is
 * relaxed so additive API fields (e.g. SMS phone keys on alert-channel
 * displayConfig) do not break older surfaces.
 *
 * The rewrite replaces every `.strict()` call within a response-shape
 * declaration with `.passthrough()`. This doesn't affect typing (Zod's
 * `.passthrough()` still produces a correctly typed `T`), only runtime parsing.
 */
export function relaxResponseStrict(source, tolerant) {
    const tolerantSet = tolerant ? new Set(tolerant) : undefined;
    const declRe = /^const\s+(\w+)\b/gm;
    const strictRe = /\.strict\(\)/g;
    function isResponseShape(name) {
        return isTolerantDecodeSchema(name, tolerantSet);
    }
    const declarations = [];
    let match;
    while ((match = declRe.exec(source)) !== null) {
        declarations.push({ start: match.index, name: match[1] });
    }
    if (declarations.length === 0)
        return source;
    let out = source.slice(0, declarations[0].start);
    for (let i = 0; i < declarations.length; i++) {
        const { start, name } = declarations[i];
        const end = i + 1 < declarations.length ? declarations[i + 1].start : source.length;
        const body = source.slice(start, end);
        if (isResponseShape(name)) {
            out += body.replace(strictRe, ".passthrough()");
        }
        else {
            out += body;
        }
    }
    return out;
}
/**
 * Rewrite `z.union([A, B, C])` calls into `z.discriminatedUnion("d", [A, B, C])`
 * where `[A, B, C]` matches the subtype list of one of the supplied unions
 * (in any order). Operates on the raw generated source — we don't need full
 * AST parsing because openapi-zod-client emits a stable, regex-friendly form.
 *
 * Robustness notes:
 *   - The match accepts arbitrary whitespace/newlines between identifiers.
 *   - Subtype lists must match exactly (set equality) — refuses to rewrite
 *     supersets or subsets so we never accidentally widen a real union.
 *   - The output preserves member order from the source (does NOT reorder),
 *     so resulting code is `z.discriminatedUnion("type", [B, A, C])` if the
 *     source had `z.union([B, A, C])`.
 */
export function rewriteUnionsAsDiscriminated(source, unions) {
    if (unions.length === 0)
        return source;
    // Build a lookup: sorted-subtype-key -> {discriminator, originalOrder}.
    const lookup = new Map();
    for (const u of unions) {
        const key = [...u.subtypes].sort().join(",");
        lookup.set(key, u.discriminator);
    }
    // Match z.union([Ident, Ident, ...]). Allow whitespace, newlines, and a
    // trailing comma. Identifier set is conservative — only matches PascalCase
    // names that look like generated schema bindings.
    const unionRe = /z\.union\(\s*\[\s*([A-Z][A-Za-z0-9_]*(?:\s*,\s*[A-Z][A-Za-z0-9_]*)*)\s*,?\s*\]\s*\)/g;
    return source.replace(unionRe, (full, members) => {
        const memberList = members
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const key = [...memberList].sort().join(",");
        const disc = lookup.get(key);
        if (!disc)
            return full;
        return `z.discriminatedUnion("${disc}", [${memberList.join(", ")}])`;
    });
}
