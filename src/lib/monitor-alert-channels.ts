/**
 * Helpers for the `--alert-channels` flag on `devhelm monitors
 * create / update` and the `monitors set-channels` subcommand
 * (DevEx P1.Bug3). Wraps `PUT /api/v1/monitors/{id}/alert-channels`,
 * which replaces the linked channel set.
 *
 * Parsing is intentionally lenient: leading/trailing whitespace and
 * commas are stripped, and the empty string clears all channels (for
 * `update` and `set-channels`). On `create`, an empty list is treated
 * as "no channels requested" and the call is skipped.
 */
import {apiPut, apiDelete, type ApiClient} from './api-client.js'

export function parseAlertChannelsFlag(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export async function setAlertChannels(
  monitorId: string,
  channelIds: readonly string[],
  client: ApiClient,
  monitorPath: string = '/api/v1/monitors',
): Promise<void> {
  await apiPut(client, `${monitorPath}/${monitorId}/alert-channels`, {
    channelIds: [...channelIds],
  })
}

/**
 * Attach channels right after `create` succeeded. On failure, delete the
 * monitor so the operator isn't left with a half-configured resource.
 * Mirrors the rollback story in `applyAssertions` so the two
 * post-create hooks behave the same way under failure.
 */
export async function attachAlertChannelsOrRollback(
  monitorId: string,
  channelIds: readonly string[],
  client: ApiClient,
  monitorPath: string = '/api/v1/monitors',
): Promise<void> {
  if (channelIds.length === 0) return
  try {
    await setAlertChannels(monitorId, channelIds, client, monitorPath)
  } catch (err) {
    let cleanup = true
    try {
      await apiDelete(client, `${monitorPath}/${monitorId}`)
    } catch {
      cleanup = false
    }
    const original = err instanceof Error ? err.message : String(err)
    const tail = cleanup
      ? 'Monitor was rolled back.'
      : `Monitor ${monitorId} could NOT be rolled back automatically — delete it manually if it still exists.`
    throw new Error(`Failed to attach --alert-channels: ${original}. ${tail}`)
  }
}
