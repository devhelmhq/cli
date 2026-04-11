/**
 * Central registry mapping each resource key to its generated OpenAPI types.
 *
 * This single definition drives type safety across CRUD commands, the YAML
 * engine, and the diff/apply layer.  All DTO, create-request, and
 * update-request types flow from here — no manual duplication.
 */
import type {components} from './api.generated.js'

type Schemas = components['schemas']

export type ResourceKey =
  | 'monitor'
  | 'incident'
  | 'alertChannel'
  | 'notificationPolicy'
  | 'environment'
  | 'secret'
  | 'tag'
  | 'resourceGroup'
  | 'webhook'
  | 'apiKey'
  | 'serviceSubscription'

export interface ResourceTypeEntry<
  TDto,
  TCreate = never,
  TUpdate = never,
> {
  dto: TDto
  create: TCreate
  update: TUpdate
}

export interface ResourceTypeMap {
  monitor: ResourceTypeEntry<
    Schemas['MonitorDto'],
    Schemas['CreateMonitorRequest'],
    Schemas['UpdateMonitorRequest']
  >
  incident: ResourceTypeEntry<
    Schemas['IncidentDto'],
    Schemas['CreateManualIncidentRequest']
  >
  alertChannel: ResourceTypeEntry<
    Schemas['AlertChannelDto'],
    Schemas['CreateAlertChannelRequest'],
    Schemas['UpdateAlertChannelRequest']
  >
  notificationPolicy: ResourceTypeEntry<
    Schemas['NotificationPolicyDto'],
    Schemas['CreateNotificationPolicyRequest'],
    Schemas['UpdateNotificationPolicyRequest']
  >
  environment: ResourceTypeEntry<
    Schemas['EnvironmentDto'],
    Schemas['CreateEnvironmentRequest'],
    Schemas['UpdateEnvironmentRequest']
  >
  secret: ResourceTypeEntry<
    Schemas['SecretDto'],
    Schemas['CreateSecretRequest'],
    Schemas['UpdateSecretRequest']
  >
  tag: ResourceTypeEntry<
    Schemas['TagDto'],
    Schemas['CreateTagRequest'],
    Schemas['UpdateTagRequest']
  >
  resourceGroup: ResourceTypeEntry<
    Schemas['ResourceGroupDto'],
    Schemas['CreateResourceGroupRequest'],
    Schemas['UpdateResourceGroupRequest']
  >
  webhook: ResourceTypeEntry<
    Schemas['WebhookEndpointDto'],
    Schemas['CreateWebhookEndpointRequest'],
    Schemas['UpdateWebhookEndpointRequest']
  >
  apiKey: ResourceTypeEntry<
    Schemas['ApiKeyDto'],
    Schemas['CreateApiKeyRequest']
  >
  serviceSubscription: ResourceTypeEntry<
    Schemas['ServiceSubscriptionDto']
  >
}

/** Convenience: extract the DTO type for a given resource key. */
export type DtoOf<K extends ResourceKey> = ResourceTypeMap[K]['dto']
/** Convenience: extract the create request type for a given resource key. */
export type CreateOf<K extends ResourceKey> = ResourceTypeMap[K]['create']
/** Convenience: extract the update request type for a given resource key. */
export type UpdateOf<K extends ResourceKey> = ResourceTypeMap[K]['update']
