/**
 * Partial-failure signalling for the YAML apply pipeline.
 *
 * When a handler (or the child reconciler underneath it) fails *after*
 * having mutated the API, we cannot simply throw a plain `Error` and let
 * the applier discard the work — that loses the parent ID of an
 * already-created status page, or the IDs of components that DID succeed
 * before a peer failed, and forces the next deploy to re-discover
 * everything via the API.
 *
 * Instead, the failing layer raises a `PartialApplyError` carrying the
 * partial outcome (parent id + child state map). The applier inspects the
 * error, persists the partial state into `state.json`, and still records
 * the operation as failed. The next `devhelm deploy` then has a complete,
 * accurate state file to diff against and converges with minimal API
 * calls — including identity-preserving renames that depend on state.
 *
 * This is the same "partial-state-with-warning" contract the Terraform
 * provider uses for `devhelm_monitor.Update` and `devhelm_webhook.Create`.
 */
import type {ChildStateEntry} from './state.js'

/**
 * Whatever a handler managed to land before the failure.
 *
 * - `id`: parent resource id, set when create/update succeeded for the
 *   parent body but a downstream step (e.g. child reconciliation) failed.
 *   Allows the applier to record the parent in state so it isn't seen as
 *   "missing" by the next deploy.
 *
 * - `children`: child state entries (e.g. status-page components/groups)
 *   that successfully reconciled before the failure. Allows the applier
 *   to track per-child IDs so renames and updates work on the next run.
 */
export interface PartialOutcome {
  id?: string
  children?: Record<string, ChildStateEntry>
}

export class PartialApplyError extends Error {
  readonly partial: PartialOutcome

  constructor(message: string, partial: PartialOutcome) {
    super(message)
    this.name = 'PartialApplyError'
    this.partial = partial
  }
}
