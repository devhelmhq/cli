/**
 * `--reporter junit|github|json` for `test` and `trigger`.
 *
 *   junit  → JUnit XML on stdout (one testcase per run or probe)
 *   github → workflow-command annotations on stdout (`::error file=…,line=…::`)
 *            plus a Markdown table appended to $GITHUB_STEP_SUMMARY
 *   json   → the standard wrapper document (same as `-o json`)
 */
import {appendFileSync} from 'node:fs'
import type {RunDto} from '../runs/wait.js'
import {formatDuration, isFlaky, type Verdict} from '../runs/outcome.js'

export type ReporterName = 'junit' | 'github' | 'json'

export interface ReportItem {
  /** Monitor (or file) name. */
  name: string
  type: string
  kind: 'run' | 'probe' | 'not_applicable' | 'error'
  region?: string
  attempt?: number
  run?: RunDto
  /** Probe result summary for uptime monitors. */
  probe?: {passed: boolean; responseTimeMs?: number | null; error?: string | null; statusCode?: number | null}
  /** Why nothing ran (refused upload, API error). */
  error?: {category: string; code?: string; message: string}
  verdict: Verdict
  /** Source file of the check, for annotations. */
  file?: string
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function itemMessage(i: ReportItem): string {
  if (i.error) return `${i.error.code ? `[${i.error.code}] ` : ''}${i.error.message}`
  if (i.probe) return i.probe.passed ? 'probe passed' : (i.probe.error ?? `probe failed${i.probe.statusCode ? ` (HTTP ${i.probe.statusCode})` : ''}`)
  const r = i.run
  if (!r) return ''
  const f = r.failure
  const msg = f?.message ?? r.headline ?? r.outcome ?? r.phase
  return `${msg}${r.url ? ` · ${r.url}` : ''}`
}

function caseName(i: ReportItem): string {
  const parts = [i.name]
  if (i.kind === 'probe') parts.push('(probe)')
  if (i.region) parts.push(i.region)
  if (i.attempt && i.attempt > 1) parts.push(`#${i.attempt}`)
  return parts.join(' ')
}

export function junitReport(items: ReportItem[], suite = 'devhelm'): string {
  const failures = items.filter((i) => i.verdict === 'failed').length
  const errors = items.filter((i) => i.verdict === 'no_verdict' || i.verdict === 'pending').length
  const skipped = items.filter((i) => i.kind === 'not_applicable').length
  const time = items.reduce((t, i) => t + (i.run?.durationMs ?? i.probe?.responseTimeMs ?? 0), 0) / 1000
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${xmlEscape(suite)}" tests="${items.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${time.toFixed(3)}">`,
    `  <testsuite name="${xmlEscape(suite)}" tests="${items.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${time.toFixed(3)}">`,
  ]
  for (const i of items) {
    const t = ((i.run?.durationMs ?? i.probe?.responseTimeMs ?? 0) / 1000).toFixed(3)
    const file = i.file ?? i.run?.failure?.file ?? undefined
    lines.push(`    <testcase classname="${xmlEscape(i.type)}" name="${xmlEscape(caseName(i))}"${file ? ` file="${xmlEscape(file)}"` : ''} time="${t}">`)
    const msg = xmlEscape(itemMessage(i))
    if (i.kind === 'not_applicable') lines.push(`      <skipped message="not applicable to ${xmlEscape(i.type)}"/>`)
    else if (i.verdict === 'failed') lines.push(`      <failure message="${msg}">${msg}</failure>`)
    else if (i.verdict !== 'passed') lines.push(`      <error message="${msg}">${msg}</error>`)
    if (i.run?.url) lines.push(`      <system-out>${xmlEscape(i.run.url)}</system-out>`)
    lines.push('    </testcase>')
  }
  lines.push('  </testsuite>', '</testsuites>')
  return lines.join('\n')
}

function ghEscape(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function ghProp(s: string): string {
  return ghEscape(s).replace(/:/g, '%3A').replace(/,/g, '%2C')
}

/** Annotation lines; the summary goes to $GITHUB_STEP_SUMMARY when set. */
export function githubReport(items: ReportItem[], summary: string, env: NodeJS.ProcessEnv = process.env): string {
  const out: string[] = []
  for (const i of items) {
    if (i.verdict === 'passed' && !(i.run && isFlaky(i.run))) continue
    if (i.kind === 'not_applicable') continue
    const level = i.verdict === 'failed' ? 'error' : 'warning'
    const file = i.run?.failure?.file ?? i.file
    const line = i.run?.failure?.line
    const props = [file ? `file=${ghProp(file)}` : '', line ? `line=${line}` : '', `title=${ghProp(caseName(i))}`].filter(Boolean).join(',')
    const flaky = i.verdict === 'passed' ? 'flaky pass: ' : ''
    out.push(`::${level} ${props}::${ghEscape(flaky + itemMessage(i))}`)
  }
  if (env.GITHUB_STEP_SUMMARY) {
    const rows = items.map((i) => {
      const sym = i.verdict === 'passed' ? (i.run && isFlaky(i.run) ? '~' : '✓') : i.verdict === 'failed' ? '✗' : '?'
      const link = i.run?.url ? `[${i.run.id.slice(0, 8)}](${i.run.url})` : ''
      const d = formatDuration(i.run?.durationMs ?? i.probe?.responseTimeMs ?? null)
      return `| ${sym} | ${caseName(i)} | ${i.run?.outcome ?? (i.probe ? (i.probe.passed ? 'passed' : 'failed') : i.kind)} | ${d} | ${link} |`
    })
    const md = ['### DevHelm', '', '| | Check | Outcome | Duration | Run |', '|---|---|---|---|---|', ...rows, '', summary, ''].join('\n')
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, md)
    } catch {
      // the summary is best-effort
    }
  }
  return out.join('\n')
}
