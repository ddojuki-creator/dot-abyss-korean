import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { collectEntries } from './lib/ko-pipeline.mjs'
import { sha, guides } from './lib/final-review-store.mjs'
import { technicalCheck } from './final-review-progress.mjs'
import { validateKeyAdditions } from './lib/final-review-key-additions.mjs'
import { DOMAINS, diagnostics, commonStatus } from './common-review-progress.mjs'

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const idPattern = /^(?:(?:hmn|men)_\d{11}|mas_\d{10})$/
const requireId = (id) => { if (!idPattern.test(id)) throw new Error('Expected a supported ordinary story ID'); return id }
const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16e6 })
  return { script, args, code: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error?.message }
}
const jsonRun = (script, args) => {
  const result = run(script, args)
  if (result.code !== 0) throw new Error(result.stderr || result.error || 'Child command failed')
  return JSON.parse(result.stdout)
}

export function validatePlan(plan) {
  const maxLanes = plan.maxParallelAgents ?? 3
  if (!Number.isInteger(maxLanes) || maxLanes < 1 || plan.modelPolicy !== 'inherit-current' || !Array.isArray(plan.lanes) || plan.lanes.length < 1 || plan.lanes.length > maxLanes) throw new Error('Use inherited model and stay within the declared parallel-agent limit')
  const files = new Set(), lanes = new Set()
  for (const lane of plan.lanes) {
    if (!/^[a-z0-9-]+$/.test(lane.id) || lanes.has(lane.id)) throw new Error('Invalid lane')
    lanes.add(lane.id)
    if (lane.kind === 'common') {
      if (!Array.isArray(lane.domains) || !lane.domains.length || lane.domains.some((domain) => !DOMAINS.includes(domain)) || lane.novels !== undefined) throw new Error('Invalid common lane')
      const start = lane.start
      if (!start || !lane.domains.includes(start.domain) || !Number.isInteger(start.offset) || start.offset < 1 || !Number.isInteger(start.limit) || start.limit < 1 || start.limit > 100) throw new Error('Invalid common start')
      for (const domain of lane.domains) {
        const file = `translations/${domain}/ko_KR.json`
        if (files.has(file)) throw new Error(`Overlapping ownership: ${file}`)
        files.add(file)
      }
      continue
    }
    if ((lane.kind !== undefined && lane.kind !== 'novels') || !lane.character?.trim() || !Array.isArray(lane.novels) || !lane.novels.length || lane.domains !== undefined) throw new Error('Invalid novel lane')
    for (const id of lane.novels) {
      requireId(id)
      if (files.has(id)) throw new Error(`Overlapping ownership: ${id}`)
      files.add(id)
    }
  }
  return [...files]
}

export function matchingCopies(keys, domains) {
  if (!Array.isArray(keys) || !keys.length || keys.some((key) => typeof key !== 'string')) throw new Error('Expected nonempty exact-key array')
  const wanted = new Set(keys), matches = []
  for (const { domain, data } of domains) {
    for (const row of collectEntries(data)) {
      if (wanted.has(row.key)) matches.push({ domain, path: row.path, source: row.key, value: row.value, diagnostics: diagnostics(row, row.value) })
    }
  }
  return matches
}

export function qaJobs() {
  return [
    ['scripts/validate-translations.mjs'],
    ['scripts/audit-outgame-critical.mjs'],
    ['scripts/audit-outgame-ui-hotspots.mjs'],
    ['scripts/audit-static-bundle.mjs'],
    ['scripts/audit-character-abilities.mjs'],
    ['scripts/audit-character-ability-upgrade-matrix.mjs'],
    ['scripts/audit-limit-break-ability-combos.mjs', '--all'],
    ['--test', 'scripts/tests/final-review-progress.test.mjs', 'scripts/tests/common-review-progress.test.mjs', 'scripts/tests/translation-guidance.test.mjs', 'scripts/tests/final-review-workflow.test.mjs', 'scripts/tests/novel-message-parser.test.mjs', 'scripts/tests/final-review-external-names.test.mjs'],
  ]
}

function planPreview(file) {
  const plan = read(file)
  validatePlan(plan)
  const index = read('.cache/novel-message-index.json')
  const common = plan.lanes.some((lane) => lane.kind === 'common') ? commonStatus() : []
  return { modelPolicy: plan.modelPolicy, maxParallelAgents: plan.maxParallelAgents ?? 3, started: false, runtimeConcurrencyVerified: false, lanes: plan.lanes.map((lane) => lane.kind === 'common' ? {
    id: lane.id, kind: 'common', start: lane.start,
    domains: lane.domains.map((domain) => common.find((item) => item.domain === domain)),
    semanticReview: false, snapshotPrepared: false,
  } : ({
    id: lane.id, character: lane.character,
    novels: lane.novels.map((id) => {
      const state = jsonRun('scripts/final-review-progress.mjs', ['status', id]).items[0]
      if (!state) throw new Error(`Missing story: ${id}`)
      return { ...state, file: `translations/novels/${id}/ko_KR.json`, speakers: [...new Set(index.filter((r) => r.novelId === id).map((r) => r.speaker))] }
    }),
  })) }
}

function packet(id, start = 1, limit = 40) {
  requireId(id)
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Positive start and limit 1..50 required')
  const prepared = jsonRun('scripts/final-review-progress.mjs', ['prepare', id])
  if (!prepared.snapshot) return prepared
  const snapshot = read(`docs/reviews/final-review/snapshots/${prepared.snapshot}`)
  if (start > snapshot.rows.length) throw new Error('Start beyond story')
  const compact = (r) => [r.position, r.speaker, r.source, r.value]
  return { ...prepared, semanticReview: false, columns: ['position', 'speaker', 'source', 'value'],
    contextBefore: snapshot.rows.slice(Math.max(0, start - 3), start - 1).map(compact),
    rows: snapshot.rows.slice(start - 1, start - 1 + limit).map(compact),
    contextAfter: snapshot.rows.slice(start - 1 + limit, start + 1 + limit).map(compact),
  }
}

export function checkStory(snapshot, data, positions = null, report = null) {
  const errors = []
  try { validateKeyAdditions(snapshot, data, report) } catch { errors.push('source-keys-changed') }
  const covered = positions === null ? null : new Set(positions)
  if (covered && (!covered.size || covered.size !== positions.length || positions.some((p) => !Number.isInteger(p) || p < 1 || p > snapshot.rows.length))) throw new Error('Invalid positions')
  const selected = covered ? snapshot.rows.filter((r) => covered.has(r.position)) : snapshot.rows
  const changedKeys = Object.keys(data).filter((key) => !Object.hasOwn(snapshot.originalTranslations, key) || data[key] !== snapshot.originalTranslations[key])
  if (covered && changedKeys.some((key) => !snapshot.rows.some((r) => r.source === key) || snapshot.rows.some((r) => r.source === key && !covered.has(r.position)))) errors.push('changed-key-has-unreviewed-occurrence')
  const technical = technicalCheck(selected, data)
  return { passed: errors.length === 0 && technical.passed, semanticReview: false, errors, technical, changedKeys: changedKeys.length, checkedOccurrences: selected.length }
}

function focusedCheck(name, positionsFile, reportFile) {
  const match = /^(.+)-[a-f0-9]{64}\.json$/.exec(name)
  if (!match || !idPattern.test(match[1])) throw new Error('Expected snapshot basename')
  const snapshot = read(`docs/reviews/final-review/snapshots/${name}`)
  if (name !== `${snapshot.id}-${sha(snapshot)}.json`) throw new Error('Snapshot integrity mismatch')
  if (sha(guides()) !== snapshot.instructionsSha256) throw new Error('Rules changed; inspect impact first')
  const index = read('.cache/novel-message-index.json').filter((r) => r.novelId === snapshot.id)
  if (sha(index) !== snapshot.sourceSha256) throw new Error('Source changed')
  for (const [file, hash] of Object.entries(snapshot.caches)) if (sha(fs.readFileSync(file)) !== hash) throw new Error('Source cache changed')
  return checkStory(snapshot, read(`translations/novels/${requireId(snapshot.id)}/ko_KR.json`), positionsFile ? read(positionsFile) : null, reportFile ? read(reportFile) : null)
}

function recordBatch(file) {
  const reports = read(file)
  if (!Array.isArray(reports) || !reports.length || reports.some((p) => typeof p !== 'string' || !fs.existsSync(p))) throw new Error('Expected existing report paths')
  const results = []
  for (const report of reports) {
    const data = read(report)
    const script = data.id ? 'scripts/final-review-progress.mjs' : 'scripts/common-review-progress.mjs'
    const result = run(script, ['record', report])
    results.push({ report, ...result })
    if (result.code !== 0) return { passed: false, failedReport: report, results }
  }
  return { passed: true, results }
}

function fullQa() {
  const jobs = qaJobs()
  const skipped = []
  if (fs.existsSync('Config/master.json')) jobs.push(['scripts/audit-masterdata-coverage.mjs'])
  else skipped.push({ name: 'masterdata-coverage', reason: 'Config/master.json missing; not verified' })
  const results = jobs.map(([script, ...args]) => run(script, args))
  return { passed: results.every((r) => r.code === 0), semanticReview: false, results, skipped, manifestGenerated: false, published: false }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, arg, a, b] = process.argv.slice(2)
    let result
    if (command === 'plan') result = planPreview(arg)
    else if (command === 'packet') result = packet(arg, a === undefined ? 1 : Number(a), b === undefined ? 40 : Number(b))
    else if (command === 'check') result = focusedCheck(arg, a, b)
    else if (command === 'copies') result = { semanticReview: false, matches: matchingCopies(read(arg), DOMAINS.map((domain) => ({ domain, data: read(`translations/${domain}/ko_KR.json`) }))) }
    else if (command === 'record-batch') result = recordBatch(arg)
    else if (command === 'qa' && arg === 'full') result = fullQa()
    else throw new Error('Usage: plan <plan.json> | packet <id> [start] [limit<=50] | check <snapshot-name> [positions.json] [key-addition-report.json] | copies <exact-keys.json> | record-batch <report-paths.json> | qa full')
    console.log(JSON.stringify(result, null, 2))
    if (result.passed === false) process.exitCode = 1
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
