/** Flags shared by the project commands (validate, test, plan, deploy, trigger, …). */
import {Flags} from '@oclif/core'

export const fileFlag = Flags.string({
  char: 'f',
  description: 'Config file or directory (repeatable; default devhelm.yml)',
  multiple: true,
})

/** `-o` for project commands; `text` is the pre-1.12 spelling of `table`. */
export const projectOutputFlag = Flags.string({
  char: 'o',
  description: 'Output format (default: table on a terminal, json otherwise; DEVHELM_OUTPUT overrides)',
  options: ['json', 'yaml', 'table', 'text'],
})

export function configFiles(positional: string | undefined, files: string[] | undefined): string[] {
  if (files && files.length > 0) return files
  return [positional ?? 'devhelm.yml']
}
