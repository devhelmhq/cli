/** `--code <file>` → uploaded bundle → `code{bundle, entrypoint, source}` (source from git / CI via the SDK bundler). */
import type {ApiClient} from '../api-client.js'
import {bundleCode, type MonitorCodeSpec} from '../code/bundle.js'

export async function codeFromFlag(client: ApiClient, file: string, opts: {runtimeId?: string; root?: string} = {}): Promise<MonitorCodeSpec> {
  const {code} = await bundleCode(client, file, {baseDir: process.cwd(), root: opts.root, runtimeId: opts.runtimeId})
  return code
}
