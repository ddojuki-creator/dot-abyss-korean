import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { sha } from '../lib/final-review-store.mjs'
import { validateKeyAdditions } from '../lib/final-review-key-additions.mjs'
import { checkStory } from '../final-review-workflow.mjs'
import { progressFor } from '../final-review-progress.mjs'

const fixture = () => {
  const snapshot = { id: 'hmn_99999999999', originalTranslations: { existing: 'old' }, rows: [
    { position: 1, source: 'existing' }, { position: 2, source: 'missing' }, { position: 3, source: 'missing' },
  ] }
  const data = { existing: 'old', missing: 'new' }
  const report = {
    snapshot: `${snapshot.id}-${sha(snapshot)}.json`,
    keyAdditions: [{ source: 'missing', positions: [2, 3], evidence: { reference: 'investigation.json#rows', note: 'Exact source rows and cache hash verified' } }],
    decisions: [2, 3].map((position) => ({ position, action: 'add', after: 'new', reason: 'Reviewed source and adjacent context' })),
  }
  return { snapshot, data, report }
}

test('additions are opt-in, exact, repeated-occurrence aware and not semantic approval', () => {
  const { snapshot, data, report } = fixture()
  const original = JSON.stringify(snapshot)
  assert.deepEqual(checkStory(snapshot, data, [2, 3]).errors, ['source-keys-changed'])
  assert.deepEqual(validateKeyAdditions(snapshot, data, report), ['missing'])
  assert.equal(checkStory(snapshot, data, [2, 3], report).passed, true)
  assert.equal(checkStory(snapshot, data, [2, 3], report).semanticReview, false)
  assert.equal(checkStory(snapshot, data, [2], report).passed, false)
  assert.equal(JSON.stringify(snapshot), original)
})

const gladiaEvidencePath = new URL('../../docs/reviews/final-review/drafts/batch65-hmn_10180100001-missing-key-investigation.json', import.meta.url)
const gladiaInvestigation = JSON.parse(fs.readFileSync(gladiaEvidencePath, 'utf8').replace(/^\uFEFF/, ''))
for (const id of ['hmn_10180100001', 'hmn_10180100002', 'hmn_10180100003']) {
  test(`Gladia exact missing-key regression: ${id}`, () => {
    const evidence = gladiaInvestigation.cacheEvidence.find((entry) => entry.id === id)
    const additions = gladiaInvestigation.proposedNewExactKeys[id]
    assert.equal(Object.keys(additions).length, 1)
    assert.equal(evidence.rows.length, 1)
    const { source, position } = evidence.rows[0]
    assert.ok(Object.hasOwn(additions, source))
    // Use investigation data as an isolated fixture, not a production approval.
    const snapshot = { id, originalTranslations: { existing: 'old' }, rows: Array.from({ length: position }, (_, i) => ({ position: i + 1, source: i + 1 === position ? source : 'existing' })) }
    const data = { ...snapshot.originalTranslations, ...additions }
    const report = {
      snapshot: `${id}-${sha(snapshot)}.json`,
      keyAdditions: [{ source, positions: [position], evidence: { reference: gladiaEvidencePath.pathname, note: 'Investigation-based technical fixture only' } }],
      decisions: [{ position, action: 'add', after: data[source], reason: 'Technical regression, not semantic attestation' }],
    }
    const savedSnapshot = JSON.stringify(snapshot)
    assert.deepEqual(checkStory(snapshot, data, [position]).errors, ['source-keys-changed'])
    const result = checkStory(snapshot, data, [position], report)
    assert.equal(result.passed, true)
    assert.equal(result.semanticReview, false)
    assert.equal(result.changedKeys, 1)
    assert.equal(result.checkedOccurrences, 1)
    const wrongStory = { ...report, snapshot: report.snapshot.replace(id, 'hmn_99999999999') }
    assert.equal(checkStory(snapshot, data, [position], wrongStory).passed, false)
    if (source.includes('<size=48>')) {
      const broken = { ...data, [source]: data[source].replace(/<[^>]+>/g, '') }
      const brokenReport = { ...report, decisions: [{ ...report.decisions[0], after: broken[source] }] }
      assert.deepEqual(validateKeyAdditions(snapshot, broken, brokenReport), [source])
      assert.equal(checkStory(snapshot, broken, [position], brokenReport).technical.passed, false)
      const normalized = source.replace(/\u3000/g, ' ')
      assert.notEqual(normalized, source)
      const nearMatch = { ...snapshot.originalTranslations, [normalized]: data[source] }
      const nearReport = { ...report, keyAdditions: [{ ...report.keyAdditions[0], source: normalized }] }
      assert.throws(() => validateKeyAdditions(snapshot, nearMatch, nearReport), /exact source-index/)
    }
    assert.equal(JSON.stringify(snapshot), savedSnapshot)
  })
}

const invalid = {
  deletion: ({ data }) => { delete data.existing },
  rename: ({ data }) => { delete data.existing; data.renamed = 'old' },
  'unknown source': ({ data, report }) => { data.unknown = 'new'; report.keyAdditions.push({ ...report.keyAdditions[0], source: 'unknown' }) },
  'near-match key': ({ data, report }) => { delete data.missing; data['missing '] = 'new'; report.keyAdditions[0].source = 'missing ' },
  'existing key authorization': ({ report }) => { report.keyAdditions[0].source = 'existing' },
  'duplicate authorization': ({ report }) => { report.keyAdditions.push(report.keyAdditions[0]) },
  'missing occurrence': ({ report }) => { report.keyAdditions[0].positions = [2] },
  'duplicate occurrence': ({ report }) => { report.keyAdditions[0].positions = [2, 2] },
  'wrong occurrence': ({ report }) => { report.keyAdditions[0].positions = [1, 2] },
  'no evidence': ({ report }) => { delete report.keyAdditions[0].evidence },
  'empty evidence': ({ report }) => { report.keyAdditions[0].evidence.note = ' ' },
  'missing decision': ({ report }) => { report.decisions.pop() },
  'duplicate decision': ({ report }) => { report.decisions.push(report.decisions[0]) },
  'change instead of add': ({ report }) => { report.decisions[0].action = 'change' },
  'stale value': ({ data }) => { data.missing = 'different' },
  'missing reason': ({ report }) => { report.decisions[0].reason = '' },
  'wrong baseline': ({ report }) => { report.snapshot = 'other.json' },
  'rebased snapshot': ({ snapshot, data, report }) => { snapshot.originalTranslations = { ...data }; report.snapshot = `${snapshot.id}-${sha(snapshot)}.json` },
}
for (const [name, mutate] of Object.entries(invalid)) test(`reject ${name}`, () => {
  const f = fixture()
  mutate(f)
  assert.throws(() => validateKeyAdditions(f.snapshot, f.data, f.report))
  assert.equal(checkStory(f.snapshot, f.data, [2, 3], f.report).passed, false)
})

test('authorization does not bypass technical checks or existing edited-key coverage', () => {
  const { snapshot, data, report } = fixture()
  data.existing = 'changed'
  assert.equal(checkStory(snapshot, data, [2, 3], report).passed, false)
  data.existing = 'old'
  for (const value of ['', 'x'.repeat(37), '<user>new']) {
    data.missing = value
    report.decisions.forEach((d) => { d.after = value })
    assert.equal(checkStory(snapshot, data, [2, 3], report).passed, false)
  }
})

test('changed content does not inherit prior completion or partial coverage', () => {
  const current = { id: 'test', sourceSha256: 'source', instructionsSha256: 'rules', translationSha256: 'new', occurrences: 3 }
  for (const complete of [true, false]) {
    const result = progressFor(current, [{ ...current, translationSha256: 'old', complete, ranges: [{ from: 1, to: 3, note: 'Earlier review' }] }])
    assert.equal(result.status, 'change-impact-check')
    assert.equal(result.reviewed, 0)
    assert.equal(result.next, 1)
  }
})

test('CLI check/record preserve the original snapshot and receipts, require evidence and do not carry coverage', (t) => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-key-additions-'))
  t.after(() => {
    const rel = path.relative(path.resolve(os.tmpdir()), path.resolve(root))
    assert.ok(rel.startsWith('abyss-key-additions-') && !rel.includes(path.sep))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const put = (file, data) => {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(data))
  }
  const get = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  fs.cpSync(path.join(repo, 'docs/translation'), path.join(root, 'docs/translation'), { recursive: true })
  const id = 'hmn_99999999999', base = 'docs/reviews/final-review'
  const translation = `translations/novels/${id}/ko_KR.json`
  const cacheFile = path.join(root, '.cache/source.txt')
  put('.cache/source.txt', 'synthetic source')
  put('.cache/novel-message-index.json', ['existing', 'missing', 'missing'].map((source, i) => ({ novelId: id, cacheFile, line: i + 1, command: 'message', speaker: 'test', source })))
  put(`${base}/inventory.json`, { items: [{ id }] })
  put(translation, { existing: 'old' })
  const run = (script, ...args) => spawnSync(process.execPath, [path.join(repo, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' })
  const progress = (...args) => run('final-review-progress.mjs', ...args)
  const ok = (result) => { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout) }
  const { snapshot } = ok(progress('prepare', id))
  const snapshotPath = `${base}/snapshots/${snapshot}`
  const frozenSnapshot = fs.readFileSync(path.join(root, snapshotPath))
  const report = { id, snapshot, reviewer: 'test fixture', semanticReview: true, ranges: [{ from: 1, to: 1, note: 'Original explicit review' }], decisions: [], unresolvedBlocking: [], complete: false }
  put('report.json', report)
  const prior = ok(progress('record', 'report.json'))
  const frozenReceipt = fs.readFileSync(path.join(root, prior.checkpoint))
  put(translation, { existing: 'old', missing: 'new' })
  assert.equal(ok(progress('status', id)).items[0].reviewed, 0)
  report.ranges = [{ from: 2, to: 3, note: 'Reviewed both new occurrences' }]
  put('report.json', report)
  assert.match(progress('record', 'report.json').stderr, /explicit keyAdditions/)
  Object.assign(report, { ...fixture().report, snapshot })
  put('positions.json', [2, 3])
  put('report.json', report)
  const check = () => run('final-review-workflow.mjs', 'check', snapshot, 'positions.json', 'report.json')
  assert.notEqual(run('final-review-workflow.mjs', 'check', snapshot, 'positions.json').status, 0)
  assert.equal(ok(check()).passed, true)
  for (const file of ['.cache/novel-message-index.json', '.cache/source.txt', 'docs/translation/style-core.md']) {
    const full = path.join(root, file), saved = fs.readFileSync(full)
    if (file.endsWith('.json')) { const rows = get(file); rows[1].source = 'different'; put(file, rows) }
    else fs.appendFileSync(full, 'changed')
    assert.notEqual(check().status, 0)
    assert.notEqual(progress('record', 'report.json').status, 0)
    fs.writeFileSync(full, saved)
  }
  report.complete = true
  put('report.json', report)
  assert.match(progress('record', 'report.json').stderr, /Incomplete coverage/)
  report.complete = false
  report.ranges = [{ from: 2, to: 2, note: 'Missing repetition' }]
  put('report.json', report)
  assert.match(progress('record', 'report.json').stderr, /repeated entry/)
  report.ranges = [{ from: 2, to: 3, note: 'Both occurrences' }]
  put(translation, { existing: 'edited', missing: 'new' })
  put('report.json', report)
  assert.match(progress('record', 'report.json').stderr, /repeated entry/)
  put(translation, { existing: 'old', missing: 'x'.repeat(37) })
  report.decisions.forEach((d) => { d.after = 'x'.repeat(37) })
  put('report.json', report)
  assert.match(progress('record', 'report.json').stderr, /technical checks failed/)
  put(translation, { existing: 'old', missing: 'new' })
  report.decisions.forEach((d) => { d.after = 'new' })
  put('report.json', report)
  const result = ok(progress('record', 'report.json'))
  assert.equal(result.complete, false)
  assert.equal(result.reviewed, 2)
  const stored = get(result.checkpoint)
  assert.equal(stored.snapshot, snapshot)
  assert.deepEqual(stored.report.keyAdditions, report.keyAdditions)
  assert.deepEqual(stored.changes, [{ positions: [2, 3], source: 'missing', before: null, after: 'new', reason: report.decisions[0].reason, kind: 'add' }])
  assert.equal(ok(progress('record', 'report.json')).status, 'already-recorded')
  const status = ok(progress('status', id)).items[0]
  assert.equal(status.reviewed, 2)
  assert.equal(status.next, 1)
  assert.equal(status.status, 'in-progress')
  assert.deepEqual(fs.readFileSync(path.join(root, snapshotPath)), frozenSnapshot)
  assert.deepEqual(fs.readFileSync(path.join(root, prior.checkpoint)), frozenReceipt)
  assert.deepEqual(fs.readdirSync(path.join(root, base, 'snapshots')), [snapshot])
  assert.equal(fs.readdirSync(path.join(root, base, 'checkpoints')).length, 2)
})
