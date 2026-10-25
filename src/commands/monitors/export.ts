import {writeFileSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {Args, Flags} from '@oclif/core'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {codeEntryFor, fidelityReport, writeYamlEntries, yamlEntryFor, type YamlEntry} from '../../lib/monitors/export.js'
import {findGitRoot} from '@devhelm/sdk/bundler'
import {isCodeType, resolveEnvironment, resolveMonitor, type MonitorDto} from '../../lib/monitors/resolve.js'
import {getRevisionFiles, writeFiles} from '../../lib/monitors/revisions.js'

export default class MonitorsExport extends DevhelmCommand {
  static description = 'Export monitors to files: live code, a devhelm.yml entry each, and a report of what YAML cannot express'
  static examples = [
    '<%= config.bin %> monitors export Checkout --env production --dir ./synthetics',
    '<%= config.bin %> monitors export --tag checkout --dir ./synthetics',
    '<%= config.bin %> monitors export --all --dir ./synthetics',
  ]
  static args = {monitor: Args.string({description: 'Monitor id or exact name (or use --tag / --all)'})}
  static flags = {
    ...commonFlags,
    env: envFlag,
    tag: Flags.string({description: 'Export every monitor with this tag'}),
    all: Flags.boolean({description: 'Export every monitor', default: false}),
    dir: Flags.string({description: 'Directory to write into', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsExport)
    const selectors = [args.monitor ? 1 : 0, flags.tag ? 1 : 0, flags.all ? 1 : 0].reduce((a, b) => a + b, 0)
    if (selectors !== 1) throw new ValidationError('Pass exactly one of <monitor>, --tag or --all', {code: 'FIELD_INVALID_FORMAT'})
    const client = this.client()
    let monitors: MonitorDto[]
    if (args.monitor) {
      monitors = [await resolveMonitor(client, args.monitor, {env: flags.env})]
    } else {
      const query: Record<string, string | number> = {size: 200}
      if (flags.tag) query.tag = flags.tag
      if (flags.env) query.environmentId = (await resolveEnvironment(client, flags.env)).id
      monitors = []
      for (let page = 0; page < 50; page++) {
        const resp = await apiGetPage(client, '/api/v1/monitors', apiSchemas.MonitorDto, {query: {...query, page}})
        monitors.push(...resp.data)
        if (!resp.hasNext) break
      }
      // List responses omit alertChannelIds/assertions; read each monitor in full.
      monitors = await Promise.all(monitors.map((m) => resolveMonitor(client, m.id)))
    }
    const channels = await apiGetPage(client, '/api/v1/alert-channels', apiSchemas.AlertChannelDto, {query: {page: 0, size: 200}}).catch(() => ({data: []}))
    const channelNames = new Map(channels.data.map((c) => [c.id, c.name]))
    mkdirSync(flags.dir, {recursive: true})

    const entries: YamlEntry[] = []
    const written = new Map<string, string>()
    const report: Array<{monitor: string; id: string; files: string[]; notExported: string[]}> = []
    for (const m of monitors) {
      let files: string[] = []
      let codePath: ReturnType<typeof codeEntryFor> | undefined
      if (isCodeType(m.type)) {
        if (!m.liveRevisionId) {
          this.addWarning(`${m.name}: no live revision; exported without code`)
        } else {
          const rf = await getRevisionFiles(client, m.liveRevisionId)
          // Revision paths are relative to the bundle root: write them there
          // unchanged so the local closure digest equals the live one.
          const root = findGitRoot(flags.dir) ?? flags.dir
          for (const [path, text] of Object.entries(rf.files)) {
            const prior = written.get(path)
            if (prior !== undefined && prior !== text) throw new ValidationError(`${path} differs between exported monitors; export them into separate --dir`, {code: 'EXPORT_PATH_CONFLICT'})
            written.set(path, text)
          }
          files = writeFiles(root, rf.files)
          codePath = codeEntryFor(flags.dir, root, rf)
        }
      }
      entries.push(yamlEntryFor(m, {codePath, channelNames}))
      report.push({monitor: m.name, id: m.id, files, notExported: fidelityReport(m)})
    }
    const yamlFile = writeYamlEntries(flags.dir, entries)
    const reportFile = join(flags.dir, 'export-report.json')
    writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
    await this.finish({data: {devhelmYml: yamlFile, report: reportFile, monitors: report}, human: () => {
      for (const r of report) {
        this.log(`✓ ${r.monitor}: ${r.files.length} file(s)`)
        for (const n of r.notExported) this.log(`    not in YAML: ${n}`)
      }
      this.log(`Wrote ${yamlFile} and ${reportFile}`)
    }})
  }
}
