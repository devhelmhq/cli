import {mkdirSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {Args, Flags} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {TransportError} from '../../lib/errors.js'
import {formatOutput} from '../../lib/output.js'
import {listRunArtifacts} from '../../lib/runs/evidence.js'

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'video/webm': 'webm', 'application/zip': 'zip', 'application/json': 'json', 'text/plain': 'txt',
}

export default class RunsArtifacts extends DevhelmCommand {
  static description = 'List run artifacts (screenshots, video, trace, HAR); --download saves them through signed URLs'
  static examples = ['<%= config.bin %> runs artifacts <run-id>', '<%= config.bin %> runs artifacts <run-id> --download ./evidence']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags, download: Flags.string({description: 'Directory to download every ready artifact into'})}

  async run() {
    const {args, flags} = await this.parse(RunsArtifacts)
    const client = this.client()
    const artifacts = await listRunArtifacts(client, args.id)
    const downloaded: Array<{id: string; path: string}> = []
    if (flags.download) {
      const dir = resolve(flags.download)
      mkdirSync(dir, {recursive: true})
      for (const a of artifacts) {
        const link = await apiGetSingle(client, `/api/v1/artifacts/${a.id}/download`, apiSchemas.ArtifactDownloadDto)
        let res: Response
        try {
          res = await fetch(link.url)
        } catch (cause) {
          throw new TransportError(`Downloading artifact ${a.id}: ${cause instanceof Error ? cause.message : String(cause)}`, {cause: cause instanceof Error ? cause : undefined})
        }
        if (!res.ok) {
          this.addWarning(`artifact ${a.id} (${a.kind}): download returned HTTP ${res.status}`)
          continue
        }
        const path = join(dir, `${a.kind}-${a.id}.${EXT[a.contentType ?? ''] ?? 'bin'}`)
        writeFileSync(path, new Uint8Array(await res.arrayBuffer()))
        downloaded.push({id: a.id, path})
        this.progress(`saved ${path}`)
      }
    }
    await this.finish({
      data: flags.download ? {artifacts, downloaded} : artifacts,
      human: () => this.log(formatOutput(artifacts, 'table', [
        {header: 'ID', get: (r: (typeof artifacts)[number]) => r.id},
        {header: 'KIND', get: (r: (typeof artifacts)[number]) => r.kind},
        {header: 'STATE', get: (r: (typeof artifacts)[number]) => r.lifecycle},
        {header: 'BYTES', get: (r: (typeof artifacts)[number]) => String(r.byteSize ?? '')},
        {header: 'EXPIRES', get: (r: (typeof artifacts)[number]) => r.expiresAt ?? ''},
      ])),
    })
  }
}
