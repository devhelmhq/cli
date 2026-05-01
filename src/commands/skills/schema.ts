import {Args, Command, Flags} from '@oclif/core'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {DevhelmValidationError} from '../../lib/errors.js'
import {listSkills, resolveSkillsDir, SKILL_NAMES, type SkillName} from '../../lib/skills.js'

export default class SkillsSchema extends Command {
  static override description =
    'Print the auto-generated field reference for a DevHelm resource (monitors, alert-channels, ...). Useful when an agent needs the freshest spec-driven field list.'

  static override examples = [
    '<%= config.bin %> skills schema monitors',
    '<%= config.bin %> skills schema alert-channels',
    '<%= config.bin %> skills schema incidents --skill=devhelm-investigate',
  ]

  static override args = {
    resource: Args.string({
      description: 'Resource name (monitors, alert-channels, etc.)',
      required: true,
    }),
  }

  static override flags = {
    skill: Flags.string({
      description: 'Which skill to read the reference from (defaults to auto-detect)',
      options: [...SKILL_NAMES],
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SkillsSchema)
    const skillsRoot = resolveSkillsDir()

    const candidateSkills = flags.skill ? [flags.skill as SkillName] : listSkills(skillsRoot)

    // Prefer auto-generated field references; fall back to hand-written.
    for (const skill of candidateSkills) {
      const generated = join(skillsRoot, skill, 'references', '_generated', `${args.resource}.fields.md`)
      if (existsSync(generated)) {
        this.log(readFileSync(generated, 'utf8'))
        return
      }
    }

    for (const skill of candidateSkills) {
      const handwritten = join(skillsRoot, skill, 'references', `${args.resource}.md`)
      if (existsSync(handwritten)) {
        this.log(readFileSync(handwritten, 'utf8'))
        return
      }
    }

    throw new DevhelmValidationError(
      `No reference found for resource \`${args.resource}\`.\n\nAvailable:\n  ${listAvailableResources(
        skillsRoot,
      ).join('\n  ')}`,
    )
  }
}

function listAvailableResources(skillsRoot: string): string[] {
  const out = new Set<string>()
  for (const skill of listSkills(skillsRoot)) {
    const gen = join(skillsRoot, skill, 'references', '_generated')
    for (const f of safeReaddir(gen)) {
      if (f.endsWith('.fields.md')) out.add(f.replace(/\.fields\.md$/, ''))
    }
    const handwritten = join(skillsRoot, skill, 'references')
    for (const f of safeReaddir(handwritten)) {
      if (f.endsWith('.md')) out.add(f.replace(/\.md$/, ''))
    }
  }
  return [...out].sort()
}

function safeReaddir(p: string): string[] {
  try {
    return readdirSync(p)
  } catch {
    return []
  }
}
