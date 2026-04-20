/**
 * Environment variable interpolation for YAML config values.
 *
 * Supports:
 *   ${VAR}           — required, fails if unset *or* set to the empty string
 *   ${VAR:-default}  — with fallback (used when VAR is unset *or* empty)
 *   $$               — literal '$' (escape sequence)
 *
 * **Empty-string semantics.** This module treats `VAR=""` identically to
 * `VAR` being unset, matching POSIX shell `${VAR:-default}` semantics
 * (Bash's `:-` operator). Most CI systems export "missing" secrets as the
 * empty string rather than leaving them unset; treating those as missing
 * surfaces the misconfiguration immediately instead of silently producing
 * empty URLs/tokens. To allow an explicit empty value, use the form
 * `${VAR:-}` (i.e. an empty default).
 *
 * **Security:** `interpolateObject` should be used instead of `interpolate`
 * when processing YAML configs. It operates on already-parsed objects,
 * replacing `${VAR}` references only inside string values. This prevents
 * env values containing YAML metacharacters (`:`, newlines, quotes,
 * `${...}`) from altering YAML structure or causing injection.
 */

// Matches either a literal-$ escape ($$) or a ${…} expression. The
// alternation is ordered so $$ is consumed before a following ${…} could
// be interpreted as an expression.
const ENV_VAR_OR_ESCAPE_PATTERN = /\$\$|\$\{([^}]+)\}/g

export class InterpolationError extends Error {
  constructor(
    public readonly variable: string,
    message: string,
  ) {
    super(message)
    this.name = 'InterpolationError'
  }
}

/**
 * Interpolate all ${VAR} and ${VAR:-default} expressions in a string.
 * Throws InterpolationError if a required variable is not set.
 */
export function interpolate(input: string, env: Record<string, string | undefined> = process.env): string {
  return input.replace(ENV_VAR_OR_ESCAPE_PATTERN, (match, expr: string | undefined) => {
    if (match === '$$') return '$'
    const e = expr as string
    const separatorIdx = e.indexOf(':-')
    if (separatorIdx !== -1) {
      const varName = e.slice(0, separatorIdx)
      const fallback = e.slice(separatorIdx + 2)
      const value = env[varName]
      return value !== undefined && value !== '' ? value : fallback
    }

    const varName = e.trim()
    const value = env[varName]
    if (value === undefined || value === '') {
      throw new InterpolationError(
        varName,
        `Environment variable \${${varName}} is required but not set ` +
        `(or set to an empty string). Set a non-empty value, use ` +
        `\${${varName}:-default} for a fallback, or \${${varName}:-} to ` +
        `allow an empty value.`,
      )
    }
    return value
  })
}

/**
 * Recursively walk a parsed object and interpolate `${VAR}` references
 * in string values only. Operates post-YAML-parse so env values containing
 * YAML metacharacters can never alter document structure.
 */
export function interpolateObject<T>(obj: T, env: Record<string, string | undefined> = process.env): T {
  return walkAndInterpolate(obj, env) as T
}

function walkAndInterpolate(node: unknown, env: Record<string, string | undefined>): unknown {
  if (typeof node === 'string') {
    return interpolate(node, env)
  }

  if (Array.isArray(node)) {
    return node.map((item) => walkAndInterpolate(item, env))
  }

  if (node !== null && typeof node === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      result[key] = walkAndInterpolate(value, env)
    }
    return result
  }

  return node
}

/**
 * Find all ${VAR} references in a string without resolving them.
 * Returns variable names (without fallback info).
 */
export function findVariables(input: string): string[] {
  const vars: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(ENV_VAR_OR_ESCAPE_PATTERN.source, 'g')
  while ((match = re.exec(input)) !== null) {
    if (match[0] === '$$') continue
    const expr = match[1] ?? ''
    const separatorIdx = expr.indexOf(':-')
    vars.push(separatorIdx !== -1 ? expr.slice(0, separatorIdx) : expr.trim())
  }
  return vars
}

/**
 * Find all ${VAR} references in a parsed object's string values.
 */
export function findVariablesInObject(obj: unknown): string[] {
  const vars: string[] = []
  walkStrings(obj, (s) => vars.push(...findVariables(s)))
  return vars
}

/**
 * Check which variables would fail during interpolation (no value, no default).
 * Returns array of missing variable names.
 */
export function findMissingVariables(input: string, env: Record<string, string | undefined> = process.env): string[] {
  const missing: string[] = []
  const re = new RegExp(ENV_VAR_OR_ESCAPE_PATTERN.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(input)) !== null) {
    if (match[0] === '$$') continue
    const expr = match[1] ?? ''
    const separatorIdx = expr.indexOf(':-')
    if (separatorIdx === -1) {
      const varName = expr.trim()
      if (env[varName] === undefined || env[varName] === '') {
        missing.push(varName)
      }
    }
  }
  return missing
}

/**
 * Check which variables would fail during interpolation on a parsed object.
 */
export function findMissingVariablesInObject(
  obj: unknown,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const missing: string[] = []
  walkStrings(obj, (s) => missing.push(...findMissingVariables(s, env)))
  return missing
}

function walkStrings(node: unknown, visitor: (s: string) => void): void {
  if (typeof node === 'string') {
    visitor(node)
    return
  }

  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, visitor)
    return
  }

  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      walkStrings(value, visitor)
    }
  }
}
