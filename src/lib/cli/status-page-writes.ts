/**
 * Public status-page writes (incident and maintenance create, post-update
 * and publish) share one flow: build the strict request, pass the public
 * gate (explicit notify decision without a TTY, `--confirm <token>` for the
 * exact text and audience; `--yes` never satisfies it), then POST.
 */
import type {ApiClient} from '../api-client.js'
import {apiPost, unwrapData} from '../api-client.js'
import type {JsonValue} from '../errors.js'
import {commandLine, gatePublicWrite} from './public-write.js'

export interface StatusPageWrite {
  id: string | undefined
  argv: string[]
  action: string
  page: string
  target?: string
  path: string
  /** Request body without `notifySubscribers`; validated by the caller's schema in `build`. */
  text: {[key: string]: JsonValue}
  notifySubscribers: boolean | undefined
  confirm: string | undefined
  build: (notifySubscribers: boolean) => object
}

export async function runStatusPageWrite(client: ApiClient, w: StatusPageWrite): Promise<unknown> {
  const notify = await gatePublicWrite({
    action: w.action,
    page: w.page,
    target: w.target,
    text: w.text,
    notifySubscribers: w.notifySubscribers,
    confirm: w.confirm,
    argv: commandLine(w.id, w.argv),
  })
  return unwrapData(await apiPost(client, w.path, w.build(notify)))
}
