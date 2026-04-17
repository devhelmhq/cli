/**
 * Environment variable interpolation for YAML config values.
 *
 * Supports:
 *   ${VAR}           — required, fails if unset
 *   ${VAR:-default}  — with fallback value
 *   $$               — literal '$' (escape sequence)
 *
 * Interpolation runs on the raw YAML string before parsing,
 * so it works in any value position (strings, URLs, etc.).
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
        `Environment variable \${${varName}} is required but not set. ` +
        `Set it in your environment or use \${${varName}:-default} for a fallback.`,
      )
    }
    return value
  })
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
    const expr = match[1]
    const separatorIdx = expr.indexOf(':-')
    vars.push(separatorIdx !== -1 ? expr.slice(0, separatorIdx) : expr.trim())
  }
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
    const expr = match[1]
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
