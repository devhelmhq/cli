/**
 * Deep offline validation of a DevhelmConfig against schema constraints.
 * Checks types, required fields, enum values, frequency bounds,
 * intra-YAML reference integrity, and duplicate ref keys.
 */
import type {
  DevhelmConfig, YamlMonitor, YamlAlertChannel, YamlNotificationPolicy,
  YamlResourceGroup, YamlWebhook, YamlTag, YamlEnvironment, YamlSecret,
  YamlDependency, YamlAssertion, YamlAuth, YamlIncidentPolicy,
  YamlEscalationStep, YamlMatchRule,
  YamlChannelConfig, YamlMonitorConfig,
  YamlStatusPage, YamlStatusPageComponent, YamlStatusPageComponentGroup,
} from './schema.js'
import {
  MONITOR_TYPES, HTTP_METHODS, DNS_RECORD_TYPES,
  ASSERTION_SEVERITIES, COMPARISON_OPERATORS,
  CHANNEL_TYPES, ALERT_SENSITIVITIES, HEALTH_THRESHOLD_TYPES,
  TRIGGER_RULE_TYPES, TRIGGER_SCOPES, TRIGGER_SEVERITIES, TRIGGER_AGGREGATIONS,
  MIN_FREQUENCY, MAX_FREQUENCY,
  STATUS_PAGE_VISIBILITIES, STATUS_PAGE_INCIDENT_MODES, STATUS_PAGE_COMPONENT_TYPES,
} from './schema.js'
import {ASSERTION_WIRE_TYPES} from './zod-schemas.js'
import type {ResolvedRefs} from './resolver.js'

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  errors: ValidationError[]
  warnings: ValidationError[]
}

export function validate(config: DevhelmConfig): ValidationResult {
  const ctx = new ValidationContext()
  validateConfig(config, ctx)
  return {errors: ctx.errors, warnings: ctx.warnings}
}

/**
 * Cross-references YAML config against resolved API state to catch issues
 * that pure offline validation cannot detect — e.g. an environment slug
 * rename via a `moved` block when the API does not support slug changes.
 *
 * Run after `fetchAllRefs(client, state)` and before `diff()`.
 */
export function validatePlanRefs(config: DevhelmConfig, refs: ResolvedRefs): ValidationResult {
  const ctx = new ValidationContext()

  for (let i = 0; i < (config.environments?.length ?? 0); i++) {
    const env = config.environments![i]
    if (!env.slug) continue
    const match = refs.get('environments', env.slug)
    if (!match || match.matchSource !== 'state') continue
    const apiSlug = (match.raw as {slug?: string} | undefined)?.slug
    if (apiSlug && apiSlug !== env.slug) {
      ctx.error(
        `environments[${i}].slug`,
        `Environment slug rename ("${apiSlug}" → "${env.slug}") is not supported by the API. ` +
        `The API identifies environments by slug and provides no rename endpoint. ` +
        `Either revert the slug to "${apiSlug}", or delete the environment and recreate it with the new slug.`,
      )
    }
  }

  return {errors: ctx.errors, warnings: ctx.warnings}
}

class ValidationContext {
  errors: ValidationError[] = []
  warnings: ValidationError[] = []

  private declaredNames = new Map<string, Set<string>>()

  error(path: string, message: string): void {
    this.errors.push({path, message})
  }

  warn(path: string, message: string): void {
    this.warnings.push({path, message})
  }

  declareRef(type: string, name: string, path: string): void {
    if (!this.declaredNames.has(type)) {
      this.declaredNames.set(type, new Set())
    }
    const set = this.declaredNames.get(type)!
    if (set.has(name)) {
      this.error(path, `Duplicate ${type} name "${name}" — names must be unique within each resource type`)
    }
    set.add(name)
  }

  hasRef(type: string, name: string): boolean {
    return this.declaredNames.get(type)?.has(name) ?? false
  }

  checkRef(refType: string, name: string, path: string): void {
    if (!this.hasRef(refType, name)) {
      this.warn(path, `Reference "${name}" not found in YAML ${refType} definitions. It must exist in the API at deploy time.`)
    }
  }
}

// ── Top-level config validation ────────────────────────────────────────

function validateConfig(config: DevhelmConfig, ctx: ValidationContext): void {
  if (config.version !== undefined && config.version !== '1') {
    ctx.warn('version', `Unknown config version "${config.version}". Supported: "1"`)
  }

  const hasAnyResource = config.tags?.length || config.environments?.length ||
    config.secrets?.length || config.alertChannels?.length ||
    config.notificationPolicies?.length || config.webhooks?.length ||
    config.resourceGroups?.length || config.monitors?.length ||
    config.dependencies?.length || config.statusPages?.length

  if (!hasAnyResource) {
    ctx.error('', 'Config has no resource definitions. Add at least one section (monitors, tags, etc.)')
  }

  collectDeclarations(config, ctx)

  if (config.tags) validateArray(config.tags, 'tags', ctx, validateTag)
  if (config.environments) validateArray(config.environments, 'environments', ctx, validateEnvironment)
  if (config.secrets) validateArray(config.secrets, 'secrets', ctx, validateSecretDef)
  if (config.alertChannels) validateArray(config.alertChannels, 'alertChannels', ctx, validateAlertChannel)
  if (config.notificationPolicies) validateArray(config.notificationPolicies, 'notificationPolicies', ctx, validateNotificationPolicy)
  if (config.webhooks) validateArray(config.webhooks, 'webhooks', ctx, validateWebhookDef)
  if (config.resourceGroups) validateArray(config.resourceGroups, 'resourceGroups', ctx, validateResourceGroup)
  if (config.monitors) validateArray(config.monitors, 'monitors', ctx, validateMonitor)
  if (config.dependencies) validateArray(config.dependencies, 'dependencies', ctx, validateDependency)
  if (config.statusPages) validateArray(config.statusPages, 'statusPages', ctx, validateStatusPage)
}

function collectDeclarations(config: DevhelmConfig, ctx: ValidationContext): void {
  for (const t of config.tags ?? []) if (t.name) ctx.declareRef('tags', t.name, 'tags')
  for (const e of config.environments ?? []) if (e.slug) ctx.declareRef('environments', e.slug, 'environments')
  for (const s of config.secrets ?? []) if (s.key) ctx.declareRef('secrets', s.key, 'secrets')
  for (const c of config.alertChannels ?? []) if (c.name) ctx.declareRef('alertChannels', c.name, 'alertChannels')
  for (const p of config.notificationPolicies ?? []) if (p.name) ctx.declareRef('notificationPolicies', p.name, 'notificationPolicies')
  for (const w of config.webhooks ?? []) if (w.url) ctx.declareRef('webhooks', w.url, 'webhooks')
  for (const g of config.resourceGroups ?? []) if (g.name) ctx.declareRef('resourceGroups', g.name, 'resourceGroups')
  for (const m of config.monitors ?? []) if (m.name) ctx.declareRef('monitors', m.name, 'monitors')
  for (const d of config.dependencies ?? []) if (d.service) ctx.declareRef('dependencies', d.service, 'dependencies')
  for (const sp of config.statusPages ?? []) if (sp.slug) ctx.declareRef('statusPages', sp.slug, 'statusPages')
}

// ── Generic array validator ────────────────────────────────────────────

function validateArray<T>(
  items: T[],
  section: string,
  ctx: ValidationContext,
  itemValidator: (item: T, path: string, ctx: ValidationContext) => void,
): void {
  if (!Array.isArray(items)) {
    ctx.error(section, `"${section}" must be an array`)
    return
  }
  for (let i = 0; i < items.length; i++) {
    itemValidator(items[i], `${section}[${i}]`, ctx)
  }
}

// ── Individual resource validators ─────────────────────────────────────

function validateTag(tag: YamlTag, path: string, ctx: ValidationContext): void {
  requireString(tag, 'name', path, ctx)
  if (tag.color !== undefined && typeof tag.color === 'string' && !/^#[0-9a-fA-F]{6}$/.test(tag.color)) {
    ctx.warn(`${path}.color`, 'Color should be a hex code like #FF0000')
  }
}

function validateEnvironment(env: YamlEnvironment, path: string, ctx: ValidationContext): void {
  requireString(env, 'name', path, ctx)
  requireString(env, 'slug', path, ctx)
  if (env.slug && !/^[a-z0-9_-]+$/.test(env.slug)) {
    ctx.error(`${path}.slug`, 'Slug must be lowercase alphanumeric with hyphens and underscores')
  }
}

function validateSecretDef(secret: YamlSecret, path: string, ctx: ValidationContext): void {
  requireString(secret, 'key', path, ctx)
  requireString(secret, 'value', path, ctx)
}

function validateAlertChannel(channel: YamlAlertChannel, path: string, ctx: ValidationContext): void {
  requireString(channel, 'name', path, ctx)
  if (!channel.type) {
    ctx.error(`${path}.type`, '"type" is required')
  } else if (!CHANNEL_TYPES.includes(channel.type)) {
    ctx.error(`${path}.type`, `Invalid channel type "${channel.type}". Must be one of: ${CHANNEL_TYPES.join(', ')}`)
  }
  if (!channel.config || typeof channel.config !== 'object') {
    ctx.error(`${path}.config`, '"config" is required and must be an object')
    return
  }
  validateChannelConfig(channel.type, channel.config, `${path}.config`, ctx)
}

function validateChannelConfig(type: string, config: YamlChannelConfig, path: string, ctx: ValidationContext): void {
  switch (type) {
    case 'slack':
    case 'discord':
    case 'teams':
      if (!('webhookUrl' in config) || !config.webhookUrl) {
        ctx.error(`${path}.webhookUrl`, `${type.charAt(0).toUpperCase() + type.slice(1)} channel requires "webhookUrl"`)
      }
      break
    case 'email':
      if (!('recipients' in config) || !Array.isArray(config.recipients) || config.recipients.length === 0) {
        ctx.error(`${path}.recipients`, 'Email channel requires "recipients" array with at least one address')
      }
      break
    case 'pagerduty':
      if (!('routingKey' in config) || !config.routingKey) {
        ctx.error(`${path}.routingKey`, 'PagerDuty channel requires "routingKey"')
      }
      break
    case 'opsgenie':
      if (!('apiKey' in config) || !config.apiKey) {
        ctx.error(`${path}.apiKey`, 'OpsGenie channel requires "apiKey"')
      }
      break
    case 'webhook':
      if (!('url' in config) || !config.url) {
        ctx.error(`${path}.url`, 'Webhook channel requires "url"')
      }
      break
  }
}

function validateNotificationPolicy(policy: YamlNotificationPolicy, path: string, ctx: ValidationContext): void {
  requireString(policy, 'name', path, ctx)

  if (!policy.escalation) {
    ctx.error(`${path}.escalation`, '"escalation" is required')
  } else {
    if (!policy.escalation.steps || !Array.isArray(policy.escalation.steps) || policy.escalation.steps.length === 0) {
      ctx.error(`${path}.escalation.steps`, 'Escalation must have at least one step')
    } else {
      for (let i = 0; i < policy.escalation.steps.length; i++) {
        validateEscalationStep(policy.escalation.steps[i], `${path}.escalation.steps[${i}]`, ctx)
      }
    }
  }

  if (policy.matchRules) {
    for (let i = 0; i < policy.matchRules.length; i++) {
      validateMatchRule(policy.matchRules[i], `${path}.matchRules[${i}]`, ctx)
    }
  }

  if (policy.priority !== undefined && (typeof policy.priority !== 'number' || policy.priority < 0)) {
    ctx.error(`${path}.priority`, 'Priority must be a non-negative number')
  }
}

function validateEscalationStep(step: YamlEscalationStep, path: string, ctx: ValidationContext): void {
  if (!step.channels || !Array.isArray(step.channels) || step.channels.length === 0) {
    ctx.error(`${path}.channels`, 'Each escalation step must have at least one channel')
  } else {
    for (const name of step.channels) {
      ctx.checkRef('alertChannels', name, `${path}.channels`)
    }
  }
  if (step.delayMinutes !== undefined && (typeof step.delayMinutes !== 'number' || step.delayMinutes < 0)) {
    ctx.error(`${path}.delayMinutes`, 'delayMinutes must be a non-negative number')
  }
}

function validateMatchRule(rule: YamlMatchRule, path: string, ctx: ValidationContext): void {
  if (!rule.type) {
    ctx.error(`${path}.type`, 'Match rule requires "type"')
  }
  if (rule.monitorNames) {
    for (const name of rule.monitorNames) {
      ctx.checkRef('monitors', name, `${path}.monitorNames`)
    }
  }
}

function validateWebhookDef(webhook: YamlWebhook, path: string, ctx: ValidationContext): void {
  requireString(webhook, 'url', path, ctx)
  if (!webhook.events || !Array.isArray(webhook.events) || webhook.events.length === 0) {
    ctx.error(`${path}.events`, '"events" is required and must be a non-empty array')
  }
}

function validateResourceGroup(group: YamlResourceGroup, path: string, ctx: ValidationContext): void {
  requireString(group, 'name', path, ctx)

  if (group.healthThresholdType && !HEALTH_THRESHOLD_TYPES.includes(group.healthThresholdType as typeof HEALTH_THRESHOLD_TYPES[number])) {
    ctx.error(`${path}.healthThresholdType`, `Must be one of: ${HEALTH_THRESHOLD_TYPES.join(', ')}`)
  }

  if (group.defaultFrequency !== undefined) {
    validateFrequency(group.defaultFrequency, `${path}.defaultFrequency`, ctx)
  }

  if (group.monitors) {
    for (const name of group.monitors) {
      ctx.checkRef('monitors', name, `${path}.monitors`)
    }
  }
  if (group.services) {
    for (const slug of group.services) {
      ctx.checkRef('dependencies', slug, `${path}.services`)
    }
  }
  if (group.defaultAlertChannels) {
    for (const name of group.defaultAlertChannels) {
      ctx.checkRef('alertChannels', name, `${path}.defaultAlertChannels`)
    }
  }
  if (group.defaultEnvironment) {
    ctx.checkRef('environments', group.defaultEnvironment, `${path}.defaultEnvironment`)
  }
  if (group.alertPolicy) {
    ctx.checkRef('notificationPolicies', group.alertPolicy, `${path}.alertPolicy`)
  }
}

function validateMonitor(monitor: YamlMonitor, path: string, ctx: ValidationContext): void {
  requireString(monitor, 'name', path, ctx)

  if (!monitor.type) {
    ctx.error(`${path}.type`, '"type" is required')
  } else if (!MONITOR_TYPES.includes(monitor.type)) {
    ctx.error(`${path}.type`, `Invalid type "${monitor.type}". Must be one of: ${MONITOR_TYPES.join(', ')}`)
  }

  if (!monitor.config || typeof monitor.config !== 'object') {
    ctx.error(`${path}.config`, '"config" is required and must be an object')
  } else {
    validateMonitorConfig(monitor.type, monitor.config, `${path}.config`, ctx)
  }

  if (monitor.frequency !== undefined) {
    validateFrequency(monitor.frequency, `${path}.frequency`, ctx)
  }

  if (monitor.regions && !Array.isArray(monitor.regions)) {
    ctx.error(`${path}.regions`, '"regions" must be an array of strings')
  }

  if (monitor.environment) {
    ctx.checkRef('environments', monitor.environment, `${path}.environment`)
  }
  if (monitor.tags) {
    for (const name of monitor.tags) {
      ctx.checkRef('tags', name, `${path}.tags`)
    }
  }
  if (monitor.alertChannels) {
    for (const name of monitor.alertChannels) {
      ctx.checkRef('alertChannels', name, `${path}.alertChannels`)
    }
  }
  if (monitor.assertions) {
    for (let i = 0; i < monitor.assertions.length; i++) {
      validateAssertionDef(monitor.assertions[i], `${path}.assertions[${i}]`, ctx)
    }
  }

  if (monitor.auth) {
    validateAuth(monitor.auth, `${path}.auth`, ctx)
  }

  if (monitor.incidentPolicy) {
    validateIncidentPolicy(monitor.incidentPolicy, `${path}.incidentPolicy`, ctx)
  }
}

function validateMonitorConfig(type: string, config: YamlMonitorConfig, path: string, ctx: ValidationContext): void {
  switch (type) {
    case 'HTTP':
      if (!('url' in config) || !config.url) ctx.error(`${path}.url`, 'HTTP monitor requires "url"')
      if ('method' in config && config.method && !HTTP_METHODS.includes(config.method as typeof HTTP_METHODS[number])) {
        ctx.error(`${path}.method`, `Invalid HTTP method. Must be one of: ${HTTP_METHODS.join(', ')}`)
      }
      break
    case 'DNS':
      if (!('hostname' in config) || !config.hostname) ctx.error(`${path}.hostname`, 'DNS monitor requires "hostname"')
      if ('recordTypes' in config && config.recordTypes && Array.isArray(config.recordTypes)) {
        for (const rt of config.recordTypes) {
          if (!DNS_RECORD_TYPES.includes(rt as string)) {
            ctx.error(`${path}.recordTypes`, `Invalid DNS record type "${rt}". Must be one of: ${DNS_RECORD_TYPES.join(', ')}`)
          }
        }
      }
      break
    case 'TCP':
      if (!('host' in config) || !config.host) ctx.error(`${path}.host`, 'TCP monitor requires "host"')
      if ('port' in config && config.port !== undefined && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
        ctx.error(`${path}.port`, 'TCP port must be between 1 and 65535')
      }
      break
    case 'ICMP':
      if (!('host' in config) || !config.host) ctx.error(`${path}.host`, 'ICMP monitor requires "host"')
      break
    case 'HEARTBEAT':
      if (!('expectedInterval' in config) || typeof config.expectedInterval !== 'number' || config.expectedInterval <= 0) {
        ctx.error(`${path}.expectedInterval`, 'Heartbeat monitor requires "expectedInterval" (positive number)')
      }
      if (!('gracePeriod' in config) || typeof config.gracePeriod !== 'number' || config.gracePeriod <= 0) {
        ctx.error(`${path}.gracePeriod`, 'Heartbeat monitor requires "gracePeriod" (positive number)')
      }
      break
    case 'MCP_SERVER':
      if (!('command' in config) || !config.command) ctx.error(`${path}.command`, 'MCP_SERVER monitor requires "command"')
      break
  }
}

function validateAssertionDef(assertion: YamlAssertion, path: string, ctx: ValidationContext): void {
  if (!assertion.type) {
    ctx.error(`${path}.type`, 'Assertion requires "type"')
  } else if (!ASSERTION_WIRE_TYPES.includes(assertion.type)) {
    ctx.error(`${path}.type`, `Unknown assertion type "${assertion.type}". See docs for valid assertion types.`)
  }

  if (assertion.severity && !ASSERTION_SEVERITIES.includes(assertion.severity)) {
    ctx.error(`${path}.severity`, `Assertion severity must be one of: ${ASSERTION_SEVERITIES.join(', ')}`)
  }

  if (assertion.config && assertion.type) {
    validateAssertionConfig(assertion.type, assertion.config, path, ctx)
  }
}

function validateAssertionConfig(type: string, config: Record<string, unknown>, path: string, ctx: ValidationContext): void {
  const needsOperator = ['status_code', 'header_value', 'json_path', 'redirect_target']
  if (needsOperator.includes(type)) {
    if (config.operator && !COMPARISON_OPERATORS.includes(config.operator as string)) {
      ctx.error(`${path}.config.operator`, `Invalid operator. Must be one of: ${COMPARISON_OPERATORS.join(', ')}`)
    }
  }
}

function validateAuth(auth: YamlAuth, path: string, ctx: ValidationContext): void {
  const validTypes = ['bearer', 'basic', 'api_key', 'header']
  if (!auth.type || !validTypes.includes(auth.type)) {
    ctx.error(`${path}.type`, `Auth type must be one of: ${validTypes.join(', ')}`)
  }
  if (!auth.secret) {
    ctx.error(`${path}.secret`, 'Auth requires "secret" (vault secret key reference)')
  } else {
    ctx.checkRef('secrets', auth.secret, `${path}.secret`)
  }
  if ((auth.type === 'api_key' || auth.type === 'header') && !('headerName' in auth && auth.headerName)) {
    ctx.error(`${path}.headerName`, `${auth.type} requires "headerName"`)
  }
}

function validateIncidentPolicy(policy: YamlIncidentPolicy, path: string, ctx: ValidationContext): void {
  if (!policy.triggerRules || !Array.isArray(policy.triggerRules) || policy.triggerRules.length === 0) {
    ctx.error(`${path}.triggerRules`, 'Incident policy requires at least one trigger rule')
    return
  }

  for (let i = 0; i < policy.triggerRules.length; i++) {
    const rule = policy.triggerRules[i]
    const rpath = `${path}.triggerRules[${i}]`
    if (!TRIGGER_RULE_TYPES.includes(rule.type)) {
      ctx.error(`${rpath}.type`, `Invalid trigger type. Must be one of: ${TRIGGER_RULE_TYPES.join(', ')}`)
    }
    if (rule.scope !== null && rule.scope !== undefined && !TRIGGER_SCOPES.includes(rule.scope)) {
      ctx.error(`${rpath}.scope`, `Invalid scope. Must be one of: ${TRIGGER_SCOPES.join(', ')}`)
    }
    if (!TRIGGER_SEVERITIES.includes(rule.severity)) {
      ctx.error(`${rpath}.severity`, `Must be one of: ${TRIGGER_SEVERITIES.join(', ')}`)
    }
    if (rule.aggregationType && !TRIGGER_AGGREGATIONS.includes(rule.aggregationType as string)) {
      ctx.error(`${rpath}.aggregationType`, `Must be one of: ${TRIGGER_AGGREGATIONS.join(', ')}`)
    }
  }

  if (!policy.confirmation) {
    ctx.error(`${path}.confirmation`, 'Incident policy requires "confirmation"')
  } else if (policy.confirmation.type !== 'multi_region') {
    ctx.error(`${path}.confirmation.type`, 'Confirmation type must be "multi_region"')
  }

  if (!policy.recovery) {
    ctx.error(`${path}.recovery`, 'Incident policy requires "recovery"')
  }
}

function validateFrequency(freq: number, path: string, ctx: ValidationContext): void {
  if (typeof freq !== 'number') {
    ctx.error(path, 'Frequency must be a number')
  } else if (freq < MIN_FREQUENCY || freq > MAX_FREQUENCY) {
    ctx.error(path, `Frequency must be between ${MIN_FREQUENCY} and ${MAX_FREQUENCY} seconds`)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function validateDependency(dep: YamlDependency, path: string, ctx: ValidationContext): void {
  requireString(dep, 'service', path, ctx)
  if (dep.alertSensitivity && !ALERT_SENSITIVITIES.includes(dep.alertSensitivity as typeof ALERT_SENSITIVITIES[number])) {
    ctx.error(`${path}.alertSensitivity`, `Must be one of: ${ALERT_SENSITIVITIES.join(', ')}`)
  }
}

function validateStatusPage(page: YamlStatusPage, path: string, ctx: ValidationContext): void {
  requireString(page, 'name', path, ctx)
  requireString(page, 'slug', path, ctx)
  if (page.slug && !/^[a-z0-9-]+$/.test(page.slug)) {
    ctx.error(`${path}.slug`, 'Slug must be lowercase alphanumeric with hyphens')
  }
  if (page.visibility && !STATUS_PAGE_VISIBILITIES.includes(page.visibility)) {
    ctx.error(`${path}.visibility`, `Must be one of: ${STATUS_PAGE_VISIBILITIES.join(', ')}`)
  }
  if (page.incidentMode && !STATUS_PAGE_INCIDENT_MODES.includes(page.incidentMode)) {
    ctx.error(`${path}.incidentMode`, `Must be one of: ${STATUS_PAGE_INCIDENT_MODES.join(', ')}`)
  }

  const groupNames = new Set<string>()
  if (page.componentGroups) {
    for (let i = 0; i < page.componentGroups.length; i++) {
      validateStatusPageComponentGroup(page.componentGroups[i], `${path}.componentGroups[${i}]`, ctx, groupNames)
    }
  }

  if (page.components) {
    for (let i = 0; i < page.components.length; i++) {
      validateStatusPageComponent(page.components[i], `${path}.components[${i}]`, ctx, groupNames)
    }
  }
}

function validateStatusPageComponentGroup(group: YamlStatusPageComponentGroup, path: string, ctx: ValidationContext, names: Set<string>): void {
  requireString(group, 'name', path, ctx)
  if (group.name) {
    if (names.has(group.name)) {
      ctx.error(path, `Duplicate component group name "${group.name}"`)
    }
    names.add(group.name)
  }
}

function validateStatusPageComponent(comp: YamlStatusPageComponent, path: string, ctx: ValidationContext, groupNames: Set<string>): void {
  requireString(comp, 'name', path, ctx)
  if (!comp.type) {
    ctx.error(`${path}.type`, '"type" is required')
  } else if (!STATUS_PAGE_COMPONENT_TYPES.includes(comp.type)) {
    ctx.error(`${path}.type`, `Must be one of: ${STATUS_PAGE_COMPONENT_TYPES.join(', ')}`)
  }
  if (comp.type === 'MONITOR' && !comp.monitor) {
    ctx.error(`${path}.monitor`, 'MONITOR component requires "monitor" reference')
  }
  if (comp.type === 'GROUP' && !comp.resourceGroup) {
    ctx.error(`${path}.resourceGroup`, 'GROUP component requires "resourceGroup" reference')
  }
  if (comp.monitor) ctx.checkRef('monitors', comp.monitor, `${path}.monitor`)
  if (comp.resourceGroup) ctx.checkRef('resourceGroups', comp.resourceGroup, `${path}.resourceGroup`)
  if (comp.group && !groupNames.has(comp.group)) {
    ctx.warn(`${path}.group`, `Component group "${comp.group}" not found in this status page's componentGroups`)
  }
}

function requireString(obj: object, field: string, path: string, ctx: ValidationContext): void {
  const record = obj as Record<string, unknown>
  if (!record[field] || typeof record[field] !== 'string') {
    ctx.error(`${path}.${field}`, `"${field}" is required`)
  }
}
