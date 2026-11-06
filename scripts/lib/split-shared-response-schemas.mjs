import {computeSchemaReachability} from './preprocess.mjs'

const SCHEMA_REF = '#/components/schemas/'

/**
 * Give schemas used in both directions separate wire and authoring copies.
 * The response copy can accept additive fields while the request copy stays
 * strict. Response-only components and operation responses point to the copy.
 */
export function splitSharedResponseSchemas(spec) {
  const schemas = spec.components?.schemas
  if (!schemas) return []

  const {response, request, responseOnly} = computeSchemaReachability(spec)
  const copies = new Map()
  for (const name of response) {
    if (!request.has(name)) continue
    const copy = `${name}WireResponse`
    if (Object.hasOwn(schemas, copy)) {
      throw new Error(`Cannot split shared schema ${name}: ${copy} already exists`)
    }
    copies.set(name, copy)
  }

  for (const [name, copy] of copies) {
    schemas[copy] = structuredClone(schemas[name])
  }

  function rewrite(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) rewrite(item)
      return
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string' && value.startsWith(SCHEMA_REF)) {
        const copy = copies.get(value.slice(SCHEMA_REF.length))
        if (copy) node[key] = SCHEMA_REF + copy
      } else if (key === 'mapping' && value && typeof value === 'object') {
        for (const [tag, target] of Object.entries(value)) {
          if (typeof target !== 'string' || !target.startsWith(SCHEMA_REF)) continue
          const copy = copies.get(target.slice(SCHEMA_REF.length))
          if (copy) value[tag] = SCHEMA_REF + copy
        }
      } else {
        rewrite(value)
      }
    }
  }

  for (const name of responseOnly) rewrite(schemas[name])
  for (const copy of copies.values()) rewrite(schemas[copy])
  for (const path of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(path ?? {})) {
      if (operation && typeof operation === 'object') rewrite(operation.responses)
    }
  }
  for (const responseComponent of Object.values(spec.components.responses ?? {})) {
    rewrite(responseComponent)
  }

  return [...copies.entries()]
}
