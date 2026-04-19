/**
 * Parse a YAML string (or multiple files) into a typed DevhelmConfig.
 * Handles env var interpolation, multi-file merging, and defaults application.
 * Zod schemas validate the raw YAML parse output — unknown keys and type
 * mismatches are rejected with clear, path-qualified error messages.
 */
import {readFileSync, existsSync, statSync, readdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {parse as parseYaml} from 'yaml'

import type {DevhelmConfig, YamlMonitor, YamlMonitorDefaults} from './schema.js'
import {YAML_SECTION_KEYS} from './schema.js'
import {interpolate, findMissingVariables} from './interpolation.js'
import {DevhelmConfigSchema, formatZodErrors} from './zod-schemas.js'

export class ParseError extends Error {
  constructor(message: string, public readonly file?: string) {
    super(file ? `${file}: ${message}` : message)
    this.name = 'ParseError'
  }
}

/**
 * Load and parse a single YAML file with env var interpolation.
 */
export function parseConfigFile(filePath: string, resolveEnv = true): DevhelmConfig {
  const absPath = resolve(filePath)
  if (!existsSync(absPath)) {
    throw new ParseError(`File not found: ${filePath}`)
  }

  const raw = readFileSync(absPath, 'utf8')

  let interpolated: string
  if (resolveEnv) {
    const missing = findMissingVariables(raw)
    if (missing.length > 0) {
      throw new ParseError(
        `Missing required environment variables: ${missing.join(', ')}. ` +
        'Set them or use ${VAR:-default} syntax for fallbacks.',
        filePath,
      )
    }
    interpolated = interpolate(raw)
  } else {
    interpolated = raw
  }

  let parsed: unknown
  try {
    parsed = parseYaml(interpolated)
  } catch (err) {
    throw new ParseError(`Invalid YAML: ${err instanceof Error ? err.message : String(err)}`, filePath)
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ParseError('Config file is empty or not a YAML object', filePath)
  }

  const result = DevhelmConfigSchema.safeParse(parsed)
  if (!result.success) {
    const messages = formatZodErrors(result.error)
    throw new ParseError(
      `Schema validation failed:\n  ${messages.join('\n  ')}`,
      filePath,
    )
  }

  return result.data as DevhelmConfig
}

/**
 * Load config from one or more file paths (files or directories).
 * Directories are scanned for *.yml and *.yaml files.
 */
export function loadConfig(paths: string[], resolveEnv = true): DevhelmConfig {
  const files = expandPaths(paths)
  if (files.length === 0) {
    throw new ParseError('No YAML files found in the specified paths')
  }

  if (files.length === 1) {
    const config = parseConfigFile(files[0], resolveEnv)
    return applyDefaults(config)
  }

  const configs = files.map((f) => parseConfigFile(f, resolveEnv))
  const merged = mergeConfigs(configs)
  return applyDefaults(merged)
}

/**
 * Expand file/directory paths into a flat list of .yml/.yaml files.
 */
function expandPaths(paths: string[]): string[] {
  const files: string[] = []
  for (const p of paths) {
    const absPath = resolve(p)
    if (!existsSync(absPath)) {
      throw new ParseError(`Path not found: ${p}`)
    }
    const stat = statSync(absPath)
    if (stat.isDirectory()) {
      const entries = readdirSync(absPath)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort()
        .map((f) => join(absPath, f))
      files.push(...entries)
    } else {
      files.push(absPath)
    }
  }
  return files
}

/**
 * Merge multiple configs. Arrays are concatenated. Duplicate ref keys are caught by the validator.
 * Uses YAML_SECTION_KEYS so adding a new section is a compile-time addition, not a manual edit here.
 */
function mergeConfigs(configs: DevhelmConfig[]): DevhelmConfig {
  const merged: DevhelmConfig = {}

  for (const cfg of configs) {
    if (cfg.version !== undefined) merged.version = cfg.version

    if (cfg.defaults) {
      merged.defaults = merged.defaults ?? {}
      if (cfg.defaults.monitors) {
        merged.defaults.monitors = {...merged.defaults.monitors, ...cfg.defaults.monitors}
      }
    }

    for (const key of YAML_SECTION_KEYS) {
      const items = cfg[key]
      if (items) {
        const dest = (merged as Record<string, unknown[]>)
        dest[key] = [...(dest[key] ?? []), ...items]
      }
    }
  }

  return merged
}

/**
 * Apply defaults.monitors to each monitor that doesn't override the field.
 * Shallow merge: if monitor defines a field, it wins entirely (no deep merge).
 */
function applyDefaults(config: DevhelmConfig): DevhelmConfig {
  const defaults = config.defaults?.monitors
  if (!defaults || !config.monitors?.length) return config

  return {
    ...config,
    monitors: config.monitors.map((m) => applyMonitorDefaults(m, defaults)),
  }
}

function applyMonitorDefaults(monitor: YamlMonitor, defaults: YamlMonitorDefaults): YamlMonitor {
  return {
    ...monitor,
    frequencySeconds: monitor.frequencySeconds ?? defaults.frequencySeconds,
    enabled: monitor.enabled ?? defaults.enabled,
    regions: monitor.regions ?? defaults.regions,
    alertChannels: monitor.alertChannels ?? defaults.alertChannels,
    incidentPolicy: monitor.incidentPolicy ?? defaults.incidentPolicy,
  }
}
