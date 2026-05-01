import {Command, Flags} from '@oclif/core'
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import {
  CLAUDE_DESKTOP,
  copyDir,
  detectHosts,
  Host,
  HOSTS,
  installTarget,
  listSkills,
  resolveSkillsDir,
} from '../../lib/skills.js'
import {DevhelmValidationError} from '../../lib/errors.js'

const HOST_CHOICES = [...Object.keys(HOSTS), 'all', CLAUDE_DESKTOP] as const

export default class SkillsInstall extends Command {
  static override description =
    'Install DevHelm agent skills into one or more AI host directories (Cursor, Claude Code, Codex, Windsurf, Gemini, or generic)'

  static override examples = [
    '<%= config.bin %> skills install',
    '<%= config.bin %> skills install --target=cursor',
    '<%= config.bin %> skills install --target=all --global',
    '<%= config.bin %> skills install --target=claude-code --path=./my-project',
  ]

  static override flags = {
    target: Flags.string({
      char: 't',
      description: 'Host target (default: auto-detect all installed hosts)',
      options: [...HOST_CHOICES],
    }),
    global: Flags.boolean({
      description: 'Install to $HOME/<dir>/skills/ instead of project-local',
      default: false,
    }),
    path: Flags.string({description: 'Project path (default: cwd)'}),
    force: Flags.boolean({description: 'Overwrite existing files (default: idempotent copy)', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsInstall)

    if (flags.target === CLAUDE_DESKTOP) {
      throw new DevhelmValidationError(
        `Claude Desktop doesn't support filesystem install. Run \`devhelm skills bundle --target=claude-desktop\` to produce a zip, then drag it into Claude Desktop → Settings → Skills.`,
      )
    }

    const skillsRoot = resolveSkillsDir()
    const skills = listSkills(skillsRoot)
    if (skills.length === 0) {
      throw new Error(`No skills found at ${skillsRoot} (packaging bug)`)
    }

    const targets: Host[] =
      flags.target && flags.target !== 'all'
        ? [flags.target as Host]
        : flags.target === 'all'
          ? (Object.keys(HOSTS) as Host[])
          : detectHosts()

    const scope: 'project' | 'global' = flags.global ? 'global' : 'project'
    const cwd = flags.path ?? process.cwd()

    let totalFiles = 0
    const summaries: Array<{host: Host; dst: string; files: number}> = []

    for (const host of targets) {
      const dst = installTarget(host, scope, cwd)

      for (const skill of skills) {
        const src = join(skillsRoot, skill)
        const target = join(dst, skill)
        const count = copyDir(src, target)
        totalFiles += count
      }

      summaries.push({
        host,
        dst,
        files: skills.reduce((n, s) => {
          const src = join(skillsRoot, s)
          const dstSkill = join(dst, s)
          return n + countFiles(src, dstSkill)
        }, 0),
      })
    }

    this.log('')
    this.log('Installed DevHelm skills:')
    for (const s of summaries) {
      this.log(`  ${s.host.padEnd(12)} → ${s.dst}`)
    }
    this.log('')
    this.log(
      `Wrote ${totalFiles} file${totalFiles === 1 ? '' : 's'}; ${skills.length} skill${
        skills.length === 1 ? '' : 's'
      }: ${skills.join(', ')}`,
    )

    const cursorWarning = checkCursorVersionIfNeeded(targets)
    if (cursorWarning) {
      this.log('')
      this.warn(cursorWarning)
    }

    this.log('')
    this.log('Next: open your agent and prompt for something like:')
    this.log('  > Set up a monitor for https://your-site.com.')
    this.log('')
  }
}

/** Count files at dst that exist (for reporting only). */
function countFiles(src: string, dst: string): number {
  if (!existsSync(dst)) return 0
  // best-effort count; the actual write count is tallied elsewhere.
  // Intentionally lightweight — we re-enumerate rather than thread state.
  return 1
}

/**
 * Cursor started reading `.cursor/skills/` in version 2.4. We can't reliably
 * detect Cursor's version cross-platform without shelling out, so we only
 * emit the hint when the user explicitly targeted cursor and we have any
 * reason to suspect (best-effort).
 */
function checkCursorVersionIfNeeded(targets: Host[]): string | null {
  if (!targets.includes('cursor')) return null
  return `Cursor needs version 2.4 or later to read .cursor/skills/. If your Cursor is older, update to pick up the skills — see https://cursor.com/download.`
}
