import {existsSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

export interface AuthContext {
  name: string
  apiUrl: string
  token: string
}

interface ContextsFile {
  current: string
  contexts: Record<string, AuthContext>
}

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
  const file = readContextsFile() ?? {current: '', contexts: {}}
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
  return JSON.parse(readFileSync(CONTEXTS_PATH, 'utf8'))
}

function writeContextsFile(file: ContextsFile): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }

  writeFileSync(CONTEXTS_PATH, JSON.stringify(file, null, 2))
}
