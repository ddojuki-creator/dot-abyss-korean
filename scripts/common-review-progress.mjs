import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectEntries, compareProtectedTokens } from './lib/ko-pipeline.mjs'
import { sha, immutableJson, guides } from './lib/final-review-store.mjs'

export const DOMAINS = ['names', 'titles', 'descriptions', 'another_name', 'ability_descriptions', 'outgame', 'static']
const BASE = 'docs/reviews/final-review/common'
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const target = (domain) => {
  if (!DOMAINS.includes(domain)) throw new Error('Invalid common domain')
  return `translations/${domain}/ko_KR.json`
}
const entryId = (domain, parts) => sha([domain, parts])
const leafHash = (row) => sha([row.path, row.value])
function instructions() {
  return { ...guides(), ...Object.fromEntries(['docs/translation/ui-system.md', 'docs/outgame-update-qa.md', 'docs/new-character-update.md'].map((f) => [f, sha(fs.readFileSync(f))])) }
}
function loadArtifact(kind, name) {
  if (typeof name !== 'string' || path.basename(name) !== name || !/^[a-f0-9]{64}\.json$/.test(name)) throw new Error('Invalid artifact path')
  const data = read(`${BASE}/${kind}/${name}`)
  if (name !== `${sha(data)}.json`) throw new Error('Artifact integrity mismatch')
  return data
}
function history() {
  const directory = `${BASE}/checkpoints`
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter((f) => f.endsWith('.json')).sort().flatMap((f) => {
    const receipt = loadArtifact('checkpoints', f)
    const snapshot = loadArtifact('snapshots', receipt.snapshot)
    if (snapshot.domain !== receipt.domain || snapshot.instructionsSha256 !== receipt.instructionsSha256) throw new Error('Receipt/snapshot mismatch')
    return receipt.items.map((item) => ({ ...item, recordedAt: receipt.recordedAt || '', instructionsSha256: receipt.instructionsSha256, artifact: `${directory}/${f}` }))
  })
}
export function entryProgress(domain, row, instructionHash, records) {
  const prior = records.filter((r) => r.id === entryId(domain, row.path))
  const matching = prior.filter((r) => r.translationSha256 === leafHash(row))
  const exact = matching.filter((r) => r.instructionsSha256 === instructionHash).sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''))
  if (exact.length) return exact[0].action === 'hold' ? 'hold' : 'completed'
  if (matching.some((r) => r.action !== 'hold')) return 'rule-impact-check'
  return prior.length ? 'change-impact-check' : 'pending'
}
export function commonStatus() {
  const instructionHash = sha(instructions()), records = history()
  const indexed = new Map()
  for (const r of records) { if (!indexed.has(r.id)) indexed.set(r.id, []); indexed.get(r.id).push(r) }
  return DOMAINS.map((domain) => {
    const file = target(domain), rows = collectEntries(read(file)), counts = {}, next = []
    rows.forEach((row, i) => {
      const status = entryProgress(domain, row, instructionHash, indexed.get(entryId(domain, row.path)) || [])
      counts[status] = (counts[status] || 0) + 1
      if (status !== 'completed' && next.length < 3) next.push({ position: i + 1, path: row.path, status })
    })
    const currentIds = new Set(rows.map((row) => entryId(domain, row.path)))
    const removed = new Set(records.filter((r) => r.domain === domain && !currentIds.has(r.id)).map((r) => r.id)).size
    return { domain, file, entries: rows.length, counts, removedReviewedKeys: removed, next }
  })
}
export function diagnostics(row, value) {
  if (typeof value !== 'string' || !value.trim()) return ['empty-or-nonstring']
  const source = row.key
  const warnings = [...compareProtectedTokens(source, value, { lineBreaks: 'source-max' }), ...compareProtectedTokens(value, source, { lineBreaks: 'korean-dialogue' }).filter((x) => !x.startsWith('line-break'))]
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value)) warnings.push('japanese-or-han-remains')
  const numbers = (s) => (s.replace(/<[^>]*>|\{[^}]*\}/g, '').normalize('NFKC').match(/\d+(?:\.\d+)?/g) || []).sort()
  if (sha(numbers(source)) !== sha(numbers(value))) warnings.push('numeric-difference-review')
  return [...new Set(warnings)].sort()
}
export function validateDecisions(snapshot, report, currentRows) {
  if (report.semanticReview !== true || !report.reviewer?.trim() || !report.context?.trim() || !Array.isArray(report.decisions) || !report.decisions.length) throw new Error('Explicit review evidence required')
  const current = new Map(currentRows.map((r) => [sha(r.path), r])), seen = new Set()
  return report.decisions.map((decision) => {
    const { position, action, reason } = decision
    if (!Number.isInteger(position) || position < 1 || position > snapshot.rows.length || seen.has(position) || !['keep', 'change', 'hold'].includes(action) || !reason?.trim()) throw new Error('Invalid or duplicate decision')
    seen.add(position)
    const before = snapshot.rows[position - 1], live = current.get(sha(before.path))
    if (!live) throw new Error('Source key removed or changed')
    if (action === 'change' ? live.value === before.value || live.value !== decision.after : live.value !== before.value) throw new Error('Decision does not match current value')
    const warnings = diagnostics(before, live.value)
    if (action !== 'hold' && warnings.length && (warnings.includes('empty-or-nonstring') || sha(decision.acceptedWarnings || []) !== sha(warnings) || !decision.warningReason?.trim())) throw new Error('Unresolved technical warnings')
    return { id: entryId(snapshot.domain, before.path), domain: snapshot.domain, path: before.path, source: before.key, before: before.value, after: live.value, translationSha256: leafHash(live), action, reason, warnings, warningReason: decision.warningReason || null }
  })
}
function prepare(domain, limit = 40, offset = 1, selection = null, impact = false) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 1) throw new Error('Limit 1..100 and positive offset required')
  const file = target(domain), rows = collectEntries(read(file)), rules = instructions(), records = history(), rulesHash = sha(rules)
  const indexed = new Map()
  for (const r of records) { if (!indexed.has(r.id)) indexed.set(r.id, []); indexed.get(r.id).push(r) }
  if (selection !== null && (!Array.isArray(selection) || selection.some((x) => typeof x !== 'string'))) throw new Error('Selection must be exact source keys')
  const selected = rows.map((row, i) => ({ ...row, filePosition: i + 1 })).filter((row) => {
    const state = entryProgress(domain, row, rulesHash, indexed.get(entryId(domain, row.path)) || [])
    return row.filePosition >= offset && (selection === null || selection.includes(row.key)) && (impact ? ['hold', 'change-impact-check', 'rule-impact-check'].includes(state) : state === 'pending')
  }).slice(0, limit)
  if (!selected.length) return { domain, status: 'no-pending-in-range' }
  const snapshot = { version: 1, domain, file, fileSha256: sha(fs.readFileSync(file)), instructions: rules, instructionsSha256: rulesHash, sourceBasis: 'exact translation source key and structured table/field path; not proof of live runtime coverage', rows: selected }
  const name = `${sha(snapshot)}.json`
  immutableJson(`${BASE}/snapshots/${name}`, snapshot)
  return { domain, snapshot: name, rows: selected.map((r, i) => ({ position: i + 1, ...r, diagnostics: diagnostics(r, r.value) })) }
}
function record(file) {
  const report = read(file), snapshot = loadArtifact('snapshots', report.snapshot)
  if (sha(instructions()) !== snapshot.instructionsSha256) throw new Error('Instructions changed; reconcile before recording')
  const items = validateDecisions(snapshot, report, collectEntries(read(target(snapshot.domain))))
  const payload = { version: 1, domain: snapshot.domain, snapshot: report.snapshot, instructionsSha256: snapshot.instructionsSha256, report, items, screen: 'not-verified', runtimeCoverage: 'not-verified', cdn: 'not-published' }
  const previous = history().find((r) => {
    if (r.domain !== snapshot.domain) return false
    const { recordedAt, ...old } = read(r.artifact)
    return sha(old) === sha(payload)
  })
  if (previous) return { status: 'already-recorded', checkpoint: previous.artifact }
  const receipt = { ...payload, recordedAt: new Date().toISOString() }
  const name = `${sha(receipt)}.json`
  immutableJson(`${BASE}/checkpoints/${name}`, receipt)
  return { checkpoint: `${BASE}/checkpoints/${name}`, domain: snapshot.domain, reviewed: items.filter((r) => r.action !== 'hold').length, changed: items.filter((r) => r.action === 'change').length, held: items.filter((r) => r.action === 'hold').length }
}
function scan() {
  const domains = DOMAINS.map((domain) => {
    const file = target(domain), rows = collectEntries(read(file))
    return { domain, fileSha256: sha(fs.readFileSync(file)), entries: rows.length, candidates: rows.flatMap((r, i) => { const warnings = diagnostics(r, r.value); return warnings.length ? [{ position: i + 1, path: r.path, warnings }] : [] }) }
  })
  const result = { version: 1, kind: 'automatic-screening-only-not-semantic-review', domains }
  const file = `${BASE}/scans/${sha(result)}.json`
  immutableJson(file, result)
  return { file, domains: domains.map((r) => ({ domain: r.domain, entries: r.entries, candidates: r.candidates.length })) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, arg, limit, offset] = process.argv.slice(2)
    const result = command === 'status' ? commonStatus() : ['prepare', 'reconcile'].includes(command) ? prepare(arg, limit === undefined ? 40 : Number(limit), offset === undefined ? 1 : Number(offset), null, command === 'reconcile') : command === 'select' ? prepare(arg, 100, 1, read(limit)) : command === 'record' ? record(arg) : command === 'scan' ? scan() : null
    if (!result) throw new Error('Usage: common-review-progress.mjs status | scan | prepare/reconcile <domain> [limit <=100] [offset] | select <domain> <source-keys.json> | record <report.json>')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
