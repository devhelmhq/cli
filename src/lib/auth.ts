import {existsSync, readFileSync, mkdirSync, writeFileSync, copyFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {z} from 'zod'

const AuthContextSchema = z.object({
  name: z.string(),
  apiUrl: z.string(),
  token: z.string(),
})

const ContextsFileSchema = z.object({
  version: z.number().int().optional(),
  current: z.string(),
  contexts: z.record(z.string(), AuthContextSchema),
})

export type AuthContext = z.infer<typeof AuthContextSchema>
type ContextsFile = z.infer<typeof ContextsFileSchema>

const CONTEXTS_FILE_VERSION = 1
const CONFIG_DIR = join(homedir(), '.devhelm')
const CONTEXTS_PATH = join(CONFIG_DIR, 'contexts.json')

export function resolveToken(): string | undefined {
  if (process.env.DEVHELM_API_TOKEN) {
    return process.env.DEVHELM_API_TOKEN
  }

  const ctx = getCurrentContext()
  return ctx?.token
}

export function resolveApiUrl(): string {
  if (process.env.DEVHELM_API_URL) {
    return process.env.DEVHELM_API_URL
  }

  const ctx = getCurrentContext()
  return ctx?.apiUrl ?? 'https://api.devhelm.io'
}

export function getCurrentContext(): AuthContext | undefined {
  const file = readContextsFile()
  if (!file) return undefined
  return file.contexts[file.current]
}

export function listContexts(): {current: string; contexts: AuthContext[]} {
  const file = readContextsFile()
  if (!file) return {current: '', contexts: []}
  return {
    current: file.current,
    contexts: Object.values(file.contexts),
  }
}

export function saveContext(context: AuthContext, setCurrent = true): void {
  const file = readContextsFile() ?? {version: CONTEXTS_FILE_VERSION, current: '', contexts: {}}
  file.contexts[context.name] = context
  if (setCurrent) file.current = context.name
  writeContextsFile(file)
}

export function removeContext(name: string): boolean {
  const file = readContextsFile()
  if (!file || !(name in file.contexts)) return false

  delete file.contexts[name]
  if (file.current === name) {
    const remaining = Object.keys(file.contexts)
    file.current = remaining[0] ?? ''
  }

  writeContextsFile(file)
  return true
}

export function setCurrentContext(name: string): boolean {
  const file = readContextsFile()
  if (!file || !(name in file.contexts)) return false

  file.current = name
  writeContextsFile(file)
  return true
}

function readContextsFile(): ContextsFile | undefined {
  if (!existsSync(CONTEXTS_PATH)) return undefined
  let raw: string
  try {
    raw = readFileSync(CONTEXTS_PATH, 'utf8')
  } catch {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    backupCorruptFile()
    process.stderr.write('Warning: ~/.devhelm/contexts.json contains invalid JSON. A backup was saved.\n')
    return undefined
  }

  const result = ContextsFileSchema.safeParse(parsed)
  if (!result.success) {
    backupCorruptFile()
    process.stderr.write('Warning: ~/.devhelm/contexts.json has an invalid shape. A backup was saved.\n')
    return undefined
  }

  return result.data
}

function backupCorruptFile(): void {
  try {
    const backupPath = `${CONTEXTS_PATH}.bak.${Date.now()}`
    copyFileSync(CONTEXTS_PATH, backupPath)
  } catch {
    // Best-effort backup — don't crash if the copy fails
  }
}

function writeContextsFile(file: ContextsFile): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }

  file.version = CONTEXTS_FILE_VERSION
  writeFileSync(CONTEXTS_PATH, JSON.stringify(file, null, 2))
}
