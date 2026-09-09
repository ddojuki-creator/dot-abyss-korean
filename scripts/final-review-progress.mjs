import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { collectEntries, compareProtectedTokens } from './lib/ko-pipeline.mjs'
import { commonStatus } from './common-review-progress.mjs'
import { sha, immutableJson, guides } from './lib/final-review-store.mjs'
import { validateKeyAdditions } from './lib/final-review-key-additions.mjs'
import { validateExternalNameResolution } from './lib/final-review-external-names.mjs'
export { sha, immutableJson, guides } from './lib/final-review-store.mjs'

const ROOT = process.cwd()
const BASE = path.join(ROOT, 'docs/reviews/final-review')
const INDEX = path.join(ROOT, '.cache/novel-message-index.json')
const ID = /^(?:hmn|hmr|men|mas|evs)_\d{10,11}$/
const EXCLUDED = ['hmr_11030100021', 'hmr_11030100022', 'hmr_11030100023']
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const fileHash = (file) => sha(fs.readFileSync(file))
const relative = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/')

function sourceGroups() {
  const groups = new Map()
  for (const row of read(INDEX)) {
    if (!groups.has(row.novelId)) groups.set(row.novelId, [])
    groups.get(row.novelId).push(row)
  }
  return groups
}

function target(id) {
  if (!ID.test(id)) throw new Error('Invalid novel ID')
  return path.join(ROOT, 'translations/novels', id, 'ko_KR.json')
}

function stateFor(id, groups, instructionHashes) {
  const source = groups.get(id) || []
  const file = target(id)
  return {
    id, file: relative(file), sourceSha256: sha(source),
    translationSha256: fs.existsSync(file) ? fileHash(file) : null,
    instructionsSha256: sha(instructionHashes),
    occurrences: source.length,
  }
}

export function coveredPositions(ranges, count) {
  const covered = new Set()
  if (!Array.isArray(ranges)) throw new Error('Reviewed ranges are required')
  for (const range of ranges) {
    if (!Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 1 || range.to < range.from || range.to > count || !range.note?.trim()) {
      throw new Error('Invalid reviewed range or missing contextual note')
    }
    for (let i = range.from; i <= range.to; i++) covered.add(i)
  }
  return covered
}

export function progressFor(current, receipts) {
  const history = receipts.filter((r) => r.id === current.id)
  const matchingContent = history.filter((r) => r.sourceSha256 === current.sourceSha256 && r.translationSha256 === current.translationSha256 && r.cacheValid !== false)
  const exact = matchingContent.filter((r) => r.instructionsSha256 === current.instructionsSha256)
  const completed = exact.find((r) => r.complete)
  if (completed) return { status: 'completed', reviewed: current.occurrences, next: null, receipt: completed.artifact }
  if (matchingContent.some((r) => r.complete)) return { status: 'rule-impact-check', reviewed: current.occurrences, next: null, priorCompletion: true }
  const covered = new Set(exact.flatMap((r) => [...coveredPositions(r.ranges, current.occurrences)]))
  const next = Array.from({ length: current.occurrences }, (_, i) => i + 1).find((i) => !covered.has(i)) ?? null
  const changed = history.length > 0 && exact.length === 0
  return {
    status: !current.translationSha256 ? 'missing-translation' : !current.occurrences ? 'missing-source' : changed ? 'change-impact-check' : covered.size ? 'in-progress' : 'pending',
    reviewed: covered.size, next, priorCompletion: history.some((r) => r.complete),
  }
}

function receipts() {
  const directory = path.join(BASE, 'checkpoints')
  if (!fs.existsSync(directory)) return []
  const cacheHashes = new Map()
  return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => {
    const record = read(path.join(directory, name))
    if (name !== `${record.id}-${sha(record)}.json`) throw new Error(`Checkpoint integrity mismatch: ${name}`)
    const snapshot = read(path.join(BASE, 'snapshots', record.snapshot))
    if (record.snapshot !== `${record.id}-${sha(snapshot)}.json`) throw new Error('Snapshot integrity mismatch')
    const cacheValid = Object.entries(snapshot.caches).every(([file, hash]) => {
      if (!cacheHashes.has(file)) cacheHashes.set(file, fs.existsSync(file) ? fileHash(file) : null)
      return cacheHashes.get(file) === hash
    })
    return { ...record, cacheValid, artifact: `docs/reviews/final-review/checkpoints/${name}` }
  })
}

function init() {
  const file = path.join(BASE, 'inventory.json')
  if (fs.existsSync(file)) return { status: 'already-initialized', file: relative(file) }
  const groups = sourceGroups(), instructions = guides()
  const ids = new Set([...groups.keys(), ...fs.readdirSync(path.join(ROOT, 'translations/novels')).filter((id) => ID.test(id))])
  const items = [...ids].sort().map((id) => ({ ...stateFor(id, groups, instructions), baselineStatus: EXCLUDED.includes(id) ? 'excluded' : 'pending' }))
  const common = fs.readdirSync(path.join(ROOT, 'translations'), { withFileTypes: true }).filter((e) => e.isDirectory() && !['novels', 'manifest'].includes(e.name)).map((e) => path.join(ROOT, 'translations', e.name, 'ko_KR.json')).filter(fs.existsSync).map((f) => ({ file: relative(f), sha256: fileHash(f), entries: collectEntries(read(f)).length, status: 'pending-domain-review' }))
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  immutableJson(file, { version: 1, createdAt: new Date().toISOString(), head: git.status === 0 ? git.stdout.trim() : 'unavailable', sourceIndexSha256: fileHash(INDEX), instructions, exclusions: { ids: EXCLUDED, evidence: 'docs/reviews/2026-08-31-update.md' }, items, common })
  return { status: 'initialized', novels: items.length, commonFiles: common.length, excluded: EXCLUDED.length, file: relative(file) }
}

function prepare(id) {
  if (EXCLUDED.includes(id)) throw new Error('Approved exclusion; do not review this scene')
  const groups = sourceGroups(), instructions = guides(), current = stateFor(id, groups, instructions)
  const progress = progressFor(current, receipts())
  if (progress.status === 'completed' || progress.status === 'rule-impact-check') return { id, ...progress, message: 'Do not repeat completed review. Resolve rule impact separately if needed.' }
  if (!current.occurrences || !current.translationSha256) throw new Error('Verified source and translation are required')
  const data = read(target(id)), source = groups.get(id)
  const caches = Object.fromEntries([...new Set(source.map((r) => r.cacheFile))].map((file) => [file, fileHash(file)]))
  const snapshot = { version: 1, ...current, sourceIndexSha256: fileHash(INDEX), instructions, caches, originalTranslations: data, rows: source.map((row, i) => ({ position: i + 1, ...row, value: data[row.source] ?? null })) }
  const name = `${id}-${sha(snapshot)}.json`
  immutableJson(path.join(BASE, 'snapshots', name), snapshot)
  return { id, ...progress, occurrences: current.occurrences, snapshot: name, instructionsSha256: current.instructionsSha256 }
}

export function technicalCheck(rows, data) {
  const errors = [], watch = []
  for (const row of rows) {
    const value = data[row.source]
    if (typeof value !== 'string' || !value.trim()) { errors.push({ position: row.position, type: 'missing-value' }); continue }
    const tokens = [...compareProtectedTokens(row.source, value, { lineBreaks: 'korean-dialogue' }), ...compareProtectedTokens(value, row.source, { lineBreaks: 'korean-dialogue' }).filter((e) => !e.startsWith('line-break'))]
    if (tokens.length) errors.push({ position: row.position, type: 'tokens', details: tokens })
    if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value)) errors.push({ position: row.position, type: 'untranslated-japanese' })
    const lengths = value.split(/<br\s*\/?\s*>|\\n|\r?\n/gi).map((s) => [...s.replace(/<[^>]+>/g, '').trim()].length)
    if (lengths.length > 2 || Math.max(...lengths) > 36) errors.push({ position: row.position, type: 'layout', lengths })
    else if (Math.max(...lengths) > 34) watch.push({ position: row.position, lengths })
  }
  return { passed: errors.length === 0, errors, watch }
}

function record(reportFile) {
  const report = read(path.resolve(ROOT, reportFile))
  if (!ID.test(report.id) || EXCLUDED.includes(report.id)) throw new Error('Invalid or excluded ID')
  if (typeof report.snapshot !== 'string' || path.basename(report.snapshot) !== report.snapshot || !report.snapshot.endsWith('.json')) throw new Error('Invalid snapshot path')
  const snapshot = read(path.join(BASE, 'snapshots', report.snapshot))
  if (report.snapshot !== `${report.id}-${sha(snapshot)}.json` || snapshot.id !== report.id) throw new Error('Snapshot integrity mismatch')
  const instructions = guides(), current = stateFor(report.id, sourceGroups(), instructions)
  if (current.sourceSha256 !== snapshot.sourceSha256 || current.instructionsSha256 !== snapshot.instructionsSha256) throw new Error('Source or instructions changed; reconcile before recording')
  for (const [file, hash] of Object.entries(snapshot.caches)) if (fileHash(file) !== hash) throw new Error('Original cache changed; re-extract/reconcile before recording')
  if (report.semanticReview !== true || !report.reviewer?.trim() || !Array.isArray(report.decisions) || !Array.isArray(report.unresolvedBlocking)) throw new Error('Explicit semantic review attestation and decisions required')
  const ranges = coveredPositions(report.ranges, current.occurrences)
  if (!ranges.size) throw new Error('Cannot record an empty review')
  const data = read(target(report.id)), before = snapshot.originalTranslations
  const added = new Set(validateKeyAdditions(snapshot, data, report))
  if (added.size && !technicalCheck(snapshot.rows.filter((r) => added.has(r.source)), data).passed) throw new Error('Key addition technical checks failed')
  const changes = []
  for (const [key, value] of Object.entries(data)) {
    if (!added.has(key) && value === before[key]) continue
    const positions = snapshot.rows.filter((r) => r.source === key).map((r) => r.position)
    if (!positions.length || positions.some((i) => !ranges.has(i))) throw new Error('Changed or repeated entry must be reviewed in this checkpoint')
    const decision = report.decisions.find((d) => positions.includes(d.position) && d.action === (added.has(key) ? 'add' : 'change') && d.after === value && d.reason?.trim())
    if (!decision) throw new Error('Undocumented translation edit')
    changes.push({ positions, source: key, before: added.has(key) ? null : before[key], after: value, reason: decision.reason, ...(added.has(key) ? { kind: 'add' } : {}) })
  }
  for (const d of report.decisions) {
    if (!ranges.has(d.position) || !['change', 'keep', 'source-issue', ...(added.size ? ['add'] : [])].includes(d.action) || !d.reason?.trim()) throw new Error('Invalid review decision')
    if (d.action === 'add' && !added.has(snapshot.rows[d.position - 1].source)) throw new Error('Add decision does not match an actual addition')
    if (d.action === 'change') {
      const source = snapshot.rows[d.position - 1].source
      if (d.after !== data[source] || data[source] === before[source]) throw new Error('Change decision does not match an actual edit')
    }
  }
  const history = receipts()
  const repeated = history.find((r) => r.id === report.id && sha(r.report) === sha(report) && r.sourceSha256 === current.sourceSha256 && r.translationSha256 === current.translationSha256 && r.instructionsSha256 === current.instructionsSha256 && r.cacheValid)
  if (repeated) return { id: report.id, status: 'already-recorded', complete: repeated.complete, checkpoint: repeated.artifact }
  const prior = history.filter((r) => r.id === report.id && r.sourceSha256 === current.sourceSha256 && r.translationSha256 === current.translationSha256 && r.instructionsSha256 === current.instructionsSha256 && r.cacheValid)
  const coverage = new Set([...ranges, ...prior.flatMap((r) => [...coveredPositions(r.ranges, current.occurrences)])])
  const technical = technicalCheck(snapshot.rows, data)
  if (report.complete && (coverage.size !== current.occurrences || report.unresolvedBlocking.length || !technical.passed)) throw new Error('Incomplete coverage or unresolved blocking checks; completion rejected')
  if (report.complete) {
    const unresolved = history.filter((r) => r.snapshot === report.snapshot && !r.complete).flatMap((r) => r.report.unresolvedBlocking)
    for (const finding of unresolved) {
      if (report.decisions.some((d) => d.position === finding.position)) continue
      const entry = report.resolvedExternalNames?.find((e) => e.findingSha256 === sha(finding))
      let resolved = false
      if (entry?.proof?.path && /^[a-f0-9]{64}$/.test(entry.proof.sha256 || '')) {
        const proofFile = path.resolve(ROOT, entry.proof.path)
        const rel = path.relative(BASE, proofFile)
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel) && fs.existsSync(proofFile) && fileHash(proofFile) === entry.proof.sha256) {
          resolved = validateExternalNameResolution(finding, report, snapshot, read(path.join(ROOT, 'translations/names/ko_KR.json')), read(proofFile))
        }
      }
      if (!resolved) throw new Error('Earlier finding requires an explicit final decision')
    }
  }
  const receipt = { version: 1, ...current, recordedAt: new Date().toISOString(), snapshot: report.snapshot, report, ranges: report.ranges, complete: report.complete === true, reviewedTotalAtRecord: coverage.size, changes, technical, screen: 'not-verified', cdn: 'not-published' }
  const artifact = path.join(BASE, 'checkpoints', `${report.id}-${sha(receipt)}.json`)
  immutableJson(artifact, receipt)
  return { id: report.id, complete: receipt.complete, reviewed: coverage.size, occurrences: current.occurrences, changes: changes.length, technical, checkpoint: relative(artifact) }
}

function status(id) {
  const inventory = read(path.join(BASE, 'inventory.json')), groups = sourceGroups(), instructions = guides(), history = receipts()
  const ids = new Set([...inventory.items.map((x) => x.id), ...groups.keys(), ...fs.readdirSync(path.join(ROOT, 'translations/novels')).filter((x) => ID.test(x))])
  const items = [...ids].sort().filter((x) => !id || x === id).map((key) => {
    const current = stateFor(key, groups, instructions)
    return { id: key, occurrences: current.occurrences, ...(EXCLUDED.includes(key) ? { status: 'excluded', reviewed: 0, next: null } : progressFor(current, history)) }
  })
  const counts = {}
  for (const item of items) counts[item.status] = (counts[item.status] || 0) + 1
  return { counts, completed: items.filter((x) => x.status === 'completed'), attention: items.filter((x) => !['completed', 'pending', 'excluded'].includes(x.status)), next: items.filter((x) => x.status === 'pending').slice(0, 10), ...(id ? { items } : { common: commonStatus() }) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, arg] = process.argv.slice(2)
    if (command === 'init') console.log(JSON.stringify(init(), null, 2))
    else if (command === 'prepare') console.log(JSON.stringify(prepare(arg), null, 2))
    else if (command === 'record') console.log(JSON.stringify(record(arg), null, 2))
    else if (command === 'status') console.log(JSON.stringify(status(arg), null, 2))
    else throw new Error('Usage: node scripts/final-review-progress.mjs init | status [novelId] | prepare <novelId> | record <report.json>')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
