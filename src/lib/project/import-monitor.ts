/**
 * `devhelm import monitor <name|id>` (doc 42 §6.3, R12): write the
 * devhelm.yml entry (and the live code) plus the state entry, then move
 * ownership to Git for this project with `POST /monitors/{id}/transfer
 * {to: GIT, project, reason: "devhelm import"}` (confirmation-gated). Prints
 * owner before → after and the undo command.
 */
import {dirname, join} from 'node:path'
import type {ApiClient} from '../api-client.js'
import {checkedFetch} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {ValidationError, type JsonValue} from '../errors.js'
import {codeEntryFor, writeYamlEntries, yamlEntryFor} from '../monitors/export.js'
import {findGitRoot} from '@devhelm/sdk/bundler'
import {isCodeType, ownerLabel, resolveMonitor} from '../monitors/resolve.js'
import {getRevisionFiles, writeFiles} from '../monitors/revisions.js'
import {parse, parseSingle} from '../response-validation.js'
import {fetchPaginated} from '../typed-api.js'
import {loadProject} from './project.js'
import {emptyState, readState, upsertStateEntry, writeState} from '../yaml/state.js'
import {OWNER_TOOL, ownerAddress} from '../yaml/project-context.js'

export interface ImportDeps {
  client: ApiClient
  confirm: (o: {action: string; changes: JsonValue[]; confirmCommand: string; yes?: boolean; prompt?: string}) => Promise<void>
  log: (message: string) => void
}

export async function importMonitor(deps: ImportDeps, ref: string, opts: {env?: string; file: string; yes: boolean}) {
  const loaded = loadProject([opts.file])
  const project = loaded.config?.project
  if (!project) {
    throw new ValidationError(`${opts.file} has no "project:"; add one (e.g. project: acme/web) so the monitor can be owned by it`, {code: 'PROJECT_REQUIRED'})
  }
  const m = await resolveMonitor(deps.client, ref, {env: opts.env})
  const before = ownerLabel(m)
  const undoTo = (m.owner?.type ?? m.managedBy ?? 'DASHBOARD').toLowerCase().replace(/^cli$/, 'git')
  await deps.confirm({
    action: 'monitor.import',
    changes: [{monitor: m.name, environment: m.environment?.slug ?? null, ownerBefore: before, ownerAfter: `GIT · ${project}`}],
    confirmCommand: `devhelm import monitor ${JSON.stringify(m.name)}${m.environment?.slug ? ` --env ${m.environment.slug}` : ''} --yes`,
    yes: opts.yes,
    prompt: `Move ${m.name} from ${before} to Git · ${project}?`,
  })

  const configDir = loaded.configDir
  let codePath: ReturnType<typeof codeEntryFor> | undefined
  const written: string[] = []
  if (isCodeType(m.type) && m.liveRevisionId) {
    const files = await getRevisionFiles(deps.client, m.liveRevisionId)
    const root = findGitRoot(configDir) ?? configDir
    written.push(...writeFiles(root, files.files))
    codePath = codeEntryFor(configDir, root, files)
  }
  const channels = await fetchPaginated<{id: string; name: string}>(deps.client, '/api/v1/alert-channels')
  const entry = yamlEntryFor(m, {codePath, channelNames: new Map(channels.map((c) => [c.id, c.name]))})
  const yamlFile = writeYamlEntries(dirname(join(configDir, 'devhelm.yml')), [entry])

  const body = parse(apiSchemas.TransferMonitorRequest, {
    to: OWNER_TOOL,
    reason: 'devhelm import',
    project,
    ownerDeclaration: {address: ownerAddress(project, m.name) ?? null, label: m.name},
  }, 'Invalid transfer request')
  const after = parseSingle(apiSchemas.MonitorDto, await checkedFetch(deps.client.POST('/api/v1/monitors/{id}/transfer', {params: {path: {id: m.id}}, body})), `POST /api/v1/monitors/${m.id}/transfer`)

  const state = readState() ?? emptyState()
  upsertStateEntry(state, 'monitor', m.name, m.id, {})
  writeState(state)

  const undo = `devhelm monitors transfer ${m.id} --to ${undoTo} --reason "undo import"`
  deps.log(`Imported "${m.name}" into ${yamlFile}${written.length > 0 ? ` (+${written.length} code file${written.length === 1 ? '' : 's'})` : ''}`)
  deps.log(`  owner: ${before} → ${ownerLabel(after)}`)
  deps.log(`  undo: ${undo}`)
  return {monitor: {id: m.id, name: m.name}, ownerBefore: before, ownerAfter: ownerLabel(after), file: yamlFile, codeFiles: written, undo}
}
