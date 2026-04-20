/**
 * Runtime response validation helpers — port of sdk-js's `validation.ts`.
 *
 * Why: Until this lands, every CLI command unwrapped its API response with
 * `apiGet<T>(...)` whose body was `data as T` — a compile-time-only assertion
 * that silently accepted any shape from the server. Spec drift (renamed
 * field, removed enum value, missing required) would surface as a confusing
 * runtime error deep in `display()` / `transform()` rather than as a typed
 * `DevhelmError` at the API boundary.
 *
 * Now: callers that opt in by passing a Zod schema get a typed envelope
 * unwrap (`parseSingle` → `T`, `parsePage` → `Page<T>`, `parseCursorPage`
 * → `CursorPage<T>`) where unknown top-level fields raise (P1) and shape
 * mismatches throw a typed `ValidationError` with a path into the offending
 * field. The CRUD factory in `crud-commands.ts` reads `responseSchema` off
 * the per-resource `ResourceConfig` and routes through these helpers
 * automatically; ad-hoc handwritten commands can call them directly.
 */
import {z, type ZodType, type ZodIssue, type ZodError} from 'zod'
import {ValidationError} from './errors.js'

function formatZodIssue(issue: ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
  return `${path}: ${issue.message}`
}

function throwAsValidation(error: ZodError, contextLabel: string): never {
  const summary = error.issues.map(formatZodIssue).join('; ')
  throw new ValidationError(`${contextLabel} (${summary})`)
}

export function parse<T>(schema: ZodType<T>, data: unknown, contextLabel: string): T {
  const parsed = schema.safeParse(data)
  if (parsed.success) return parsed.data
  return throwAsValidation(parsed.error, contextLabel)
}

/**
 * Unwrap a `{data: T}` envelope. The envelope is `.strict()` (P1) so an
 * extra top-level field like `{data: ..., warning: "x"}` raises locally —
 * either the spec drifted or the server is sending fields the CLI doesn't
 * know how to surface, both of which the user wants to know about.
 */
export function parseSingle<T>(schema: ZodType<T>, data: unknown, context = 'Response'): T {
  const envelope = z.object({data: schema}).strict()
  const out = parse(envelope, data, `${context}: invalid SingleValueResponse envelope`)
  return out.data as T
}

export interface Page<T> {
  data: T[]
  hasNext: boolean
  hasPrev: boolean
  totalElements: number | null
  totalPages: number | null
}

export function parsePage<T>(schema: ZodType<T>, data: unknown, context = 'Response'): Page<T> {
  const envelope = z
    .object({
      data: z.array(schema),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
      totalElements: z.number().int().nullable().optional(),
      totalPages: z.number().int().nullable().optional(),
    })
    .strict()
  const out = parse(envelope, data, `${context}: invalid TableValueResult envelope`)
  return {
    data: out.data,
    hasNext: out.hasNext,
    hasPrev: out.hasPrev,
    totalElements: out.totalElements ?? null,
    totalPages: out.totalPages ?? null,
  }
}

export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export function parseCursorPage<T>(
  schema: ZodType<T>,
  data: unknown,
  context = 'Response',
): CursorPage<T> {
  const envelope = z
    .object({
      data: z.array(schema),
      nextCursor: z.string().nullable(),
      hasMore: z.boolean(),
    })
    .strict()
  const out = parse(envelope, data, `${context}: invalid CursorPage envelope`)
  return {
    data: out.data,
    nextCursor: out.nextCursor,
    hasMore: out.hasMore,
  }
}
