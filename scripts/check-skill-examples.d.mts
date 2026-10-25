export interface CommandIndex {
  /** Command id ("monitors revisions list") → accepted long flags. */
  commands: Map<string, Set<string>>
  topics: Set<string>
}
export interface Example {
  line: number
  text: string
}
export type ExampleResult = {id?: string; problem?: string} | null
export function loadCommands(manifestPath?: string): CommandIndex
export function extractExamples(markdown: string): Example[]
export function checkExample(text: string, index: CommandIndex): ExampleResult
export function checkSkills(opts?: {exec?: boolean; skillsDir?: string; manifestPath?: string}): {
  examples: number
  commands: number
  problems: string[]
}
