/** Owner tool names on the wire. Clients send `GIT` (R13). */
import {OWNER_TOOL} from '../yaml/project-context.js'

export const GIT_OWNER = OWNER_TOOL

export const OWNER_CHOICES = ['dashboard', 'git', 'terraform', 'api', 'mcp'] as const

export function ownerWire(choice: string): string {
  const c = choice.toLowerCase()
  if (c === 'git' || c === 'cli') return GIT_OWNER
  return c.toUpperCase()
}
