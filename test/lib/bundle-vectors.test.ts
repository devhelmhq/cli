/**
 * Bundle conformance vectors (doc 42 §5.3, W0-9): the server's digest
 * implementation writes docs/contracts/bundle-vectors.json; the CLI's
 * bundle path (the SDK bundler through src/lib/code/bundle.ts) must
 * produce the same closure and digest, and the same refusals.
 */
import {mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {describe, expect, test} from 'vitest'
import {checkCode, type CodeInput} from '../../src/lib/code/bundle.js'

interface Vector {
  name: string
  request: {entrypoint?: string | null; files: Record<string, string>; binaryFiles?: Record<string, string>; symlinks?: Record<string, string>; include?: string[]}
  expect: {entrypoint?: string | null; digest?: string; files?: string[]; refusal?: {code: string}}
}

const doc = JSON.parse(readFileSync(join(__dirname, '..', '..', 'docs', 'contracts', 'bundle-vectors.json'), 'utf8')) as {vectors: Vector[]}

function materialize(v: Vector): string {
  const dir = mkdtempSync(join(tmpdir(), `vec-${v.name}-`))
  mkdirSync(join(dir, '.git'))
  const put = (path: string, content: string | Buffer) => {
    const abs = join(dir, path)
    mkdirSync(dirname(abs), {recursive: true})
    writeFileSync(abs, content)
  }
  for (const [p, c] of Object.entries(v.request.files)) put(p, c)
  for (const [p, c] of Object.entries(v.request.binaryFiles ?? {})) put(p, Buffer.from(c, 'base64'))
  for (const [p, target] of Object.entries(v.request.symlinks ?? {})) {
    mkdirSync(dirname(join(dir, p)), {recursive: true})
    symlinkSync(target, join(dir, p))
  }
  return dir
}

describe('bundle conformance vectors', () => {
  test('the vendored file has every required case', () => {
    const names = doc.vectors.map((v) => v.name)
    for (const n of ['crlf-text', 'binary-file', 'non-ascii-path', 'tsconfig-paths', 'json-import', 'symlink-refused', 'import-outside-set-refused']) {
      expect(names).toContain(n)
    }
  })

  for (const v of doc.vectors) {
    test(v.name, async () => {
      const dir = materialize(v)
      const all = [...Object.keys(v.request.files), ...Object.keys(v.request.binaryFiles ?? {}), ...Object.keys(v.request.symlinks ?? {})]
      const entry = v.request.entrypoint ?? Object.keys(v.request.files).sort()[0]!
      // A set without an entrypoint (or an include-set request) is closed over the whole set.
      const input: CodeInput = v.request.include
        ? {entrypoint: entry, include: v.request.include}
        : v.request.entrypoint
          ? entry
          : {entrypoint: entry, include: all}
      const check = await checkCode(input, {baseDir: dir, runtime: null})
      if (v.expect.refusal) {
        expect(check.prepared).toBeNull()
        expect(check.errors.map((e) => e.code)).toContain(v.expect.refusal.code)
        return
      }
      expect(check.errors, JSON.stringify(check.errors)).toEqual([])
      expect(check.prepared!.fileList).toEqual(v.expect.files)
      expect(check.prepared!.digest).toBe(v.expect.digest)
    })
  }
})
