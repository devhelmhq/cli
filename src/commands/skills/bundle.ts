import {Command, Flags} from '@oclif/core'
import {createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {dirname, join, relative, resolve as pathResolve} from 'node:path'
import {createDeflateRaw} from 'node:zlib'
import {listSkills, resolveSkillsDir} from '../../lib/skills.js'

export default class SkillsBundle extends Command {
  static override description =
    'Produce a zip of the DevHelm skills suitable for Claude Desktop (Settings → Skills → Import).'

  static override examples = [
    '<%= config.bin %> skills bundle',
    '<%= config.bin %> skills bundle --out=~/Downloads/devhelm-skills.zip',
    '<%= config.bin %> skills bundle --target=claude-desktop --out=./devhelm-skills.zip',
  ]

  static override flags = {
    target: Flags.string({
      description: 'Host target for the bundle (only claude-desktop currently)',
      options: ['claude-desktop'],
      default: 'claude-desktop',
    }),
    out: Flags.string({description: 'Output zip path', default: './devhelm-skills.zip'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillsBundle)

    const skillsRoot = resolveSkillsDir()
    const skills = listSkills(skillsRoot)

    const outPath = pathResolve(
      flags.out.startsWith('~') ? flags.out.replace(/^~/, process.env.HOME ?? '~') : flags.out,
    )
    if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), {recursive: true})

    // Enumerate all files to include.
    const files: Array<{abs: string; rel: string}> = []
    for (const skill of skills) {
      walk(join(skillsRoot, skill), (abs) => {
        files.push({abs, rel: relative(skillsRoot, abs).split(/[/\\]/).join('/')})
      })
    }

    await writeZip(outPath, files)

    this.log(`Wrote ${outPath} (${skills.length} skills, ${files.length} files).`)
    this.log('')
    this.log('In Claude Desktop, go to Settings → Skills → Import skill,')
    this.log(`then select ${outPath}.`)
  }
}

function walk(dir: string, visit: (abs: string) => void): void {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, visit)
    else if (entry.isFile()) visit(full)
  }
}

/**
 * Minimal pure-JS ZIP writer. Claude Desktop's importer accepts standard
 * ZIP with DEFLATE or STORE entries. We DEFLATE everything and use the
 * classic Zip64-free layout — our tarball won't approach the 4GB limit.
 */
async function writeZip(
  outPath: string,
  files: Array<{abs: string; rel: string}>,
): Promise<void> {
  const out = createWriteStream(outPath)
  let offset = 0
  const centralEntries: Buffer[] = []

  for (const f of files) {
    const raw = readFileSync(f.abs)
    const compressed = await deflate(raw)
    const crc = crc32(raw)
    const stats = statSync(f.abs)
    const dosTime = toDosTime(stats.mtime)

    const local = buildLocalHeader({
      nameBuf: Buffer.from(f.rel, 'utf8'),
      crc,
      compSize: compressed.length,
      uncompSize: raw.length,
      dosTime,
    })
    out.write(local)
    out.write(compressed)

    const central = buildCentralHeader({
      nameBuf: Buffer.from(f.rel, 'utf8'),
      crc,
      compSize: compressed.length,
      uncompSize: raw.length,
      dosTime,
      localHeaderOffset: offset,
    })
    centralEntries.push(central)
    offset += local.length + compressed.length
  }

  const centralOffset = offset
  for (const e of centralEntries) {
    out.write(e)
    offset += e.length
  }
  const centralSize = offset - centralOffset

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(centralEntries.length, 8)
  eocd.writeUInt16LE(centralEntries.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(centralOffset, 16)
  eocd.writeUInt16LE(0, 20)
  out.write(eocd)

  await new Promise<void>((r, j) => {
    out.end(() => r())
    out.on('error', j)
  })
}

function deflate(buf: Buffer): Promise<Buffer> {
  return new Promise((r, j) => {
    const d = createDeflateRaw({level: 6})
    const chunks: Buffer[] = []
    d.on('data', (c: Buffer) => chunks.push(c))
    d.on('end', () => r(Buffer.concat(chunks)))
    d.on('error', j)
    d.end(buf)
  })
}

function buildLocalHeader(args: {
  nameBuf: Buffer
  crc: number
  compSize: number
  uncompSize: number
  dosTime: {time: number; date: number}
}): Buffer {
  const {nameBuf, crc, compSize, uncompSize, dosTime} = args
  const h = Buffer.alloc(30 + nameBuf.length)
  h.writeUInt32LE(0x04034b50, 0)
  h.writeUInt16LE(20, 4) // version needed
  h.writeUInt16LE(0, 6) // flags
  h.writeUInt16LE(8, 8) // DEFLATE
  h.writeUInt16LE(dosTime.time, 10)
  h.writeUInt16LE(dosTime.date, 12)
  h.writeUInt32LE(crc, 14)
  h.writeUInt32LE(compSize, 18)
  h.writeUInt32LE(uncompSize, 22)
  h.writeUInt16LE(nameBuf.length, 26)
  h.writeUInt16LE(0, 28)
  nameBuf.copy(h, 30)
  return h
}

function buildCentralHeader(args: {
  nameBuf: Buffer
  crc: number
  compSize: number
  uncompSize: number
  dosTime: {time: number; date: number}
  localHeaderOffset: number
}): Buffer {
  const {nameBuf, crc, compSize, uncompSize, dosTime, localHeaderOffset} = args
  const h = Buffer.alloc(46 + nameBuf.length)
  h.writeUInt32LE(0x02014b50, 0)
  h.writeUInt16LE(20, 4) // version made by
  h.writeUInt16LE(20, 6) // version needed
  h.writeUInt16LE(0, 8) // flags
  h.writeUInt16LE(8, 10) // DEFLATE
  h.writeUInt16LE(dosTime.time, 12)
  h.writeUInt16LE(dosTime.date, 14)
  h.writeUInt32LE(crc, 16)
  h.writeUInt32LE(compSize, 20)
  h.writeUInt32LE(uncompSize, 24)
  h.writeUInt16LE(nameBuf.length, 28)
  h.writeUInt16LE(0, 30) // extra len
  h.writeUInt16LE(0, 32) // comment len
  h.writeUInt16LE(0, 34) // disk number
  h.writeUInt16LE(0, 36) // internal attrs
  h.writeUInt32LE(0, 38) // external attrs
  h.writeUInt32LE(localHeaderOffset, 42)
  nameBuf.copy(h, 46)
  return h
}

function toDosTime(d: Date): {time: number; date: number} {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return {time, date}
}

// CRC32 (standard IEEE 802.3 polynomial, Castagnoli unused here).
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i]!
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}
