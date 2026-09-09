import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { coveredPositions, progressFor, technicalCheck } from '../final-review-progress.mjs'

const current = { id: 'hmn_11030100001', sourceSha256: 'source', translationSha256: 'translation', instructionsSha256: 'rules', occurrences: 4 }
const range = (from, to) => ({ from, to, note: 'Actually reviewed adjacent context' })
const receipt = (extra = {}) => ({ ...current, complete: false, ranges: [range(1, 2)], ...extra })

test('interrupted review resumes at the first uncovered occurrence', () => {
  const progress = progressFor(current, [receipt()])
  assert.equal(progress.status, 'in-progress')
  assert.equal(progress.next, 3)
  assert.equal(progress.reviewed, 2)
})
test('overlapping checkpoints do not inflate coverage or hide gaps', () => {
  const progress = progressFor(current, [receipt(), receipt({ ranges: [range(2, 2), range(4, 4)] })])
  assert.equal(progress.reviewed, 3)
  assert.equal(progress.next, 3)
})
test('unchanged completed files are skipped', () => {
  const progress = progressFor(current, [receipt({ complete: true, ranges: [range(1, 4)] })])
  assert.equal(progress.status, 'completed')
  assert.equal(progress.next, null)
})
test('new rules preserve completion and require impact checking, not a restart', () => {
  const progress = progressFor({ ...current, instructionsSha256: 'new' }, [receipt({ complete: true })])
  assert.equal(progress.status, 'rule-impact-check')
  assert.equal(progress.priorCompletion, true)
  assert.equal(progress.next, null)
})
test('changed translation or source cannot inherit stale completed state', () => {
  for (const key of ['sourceSha256', 'translationSha256']) {
    const progress = progressFor({ ...current, [key]: 'new' }, [receipt({ complete: true })])
    assert.equal(progress.status, 'change-impact-check')
    assert.equal(progress.priorCompletion, true)
  }
})
test('changed original cache cannot be skipped using a stale source index', () => {
  assert.equal(progressFor(current, [receipt({ complete: true, cacheValid: false })]).status, 'change-impact-check')
})
test('ranges must be explicit, in bounds and accompanied by notes', () => {
  assert.equal(coveredPositions([range(1, 2), range(2, 4)], 4).size, 4)
  for (const ranges of [[range(0, 1)], [range(2, 1)], [range(1, 5)], [{ from: 1, to: 2 }]]) assert.throws(() => coveredPositions(ranges, 4))
})
test('technical checks protect tags and reject overflow without requiring source linebreaks', () => {
  const rows = [{ position: 1, source: '<user>さん<br>こんにちは。' }]
  assert.equal(technicalCheck(rows, { [rows[0].source]: '<user>씨, 안녕하세요.' }).passed, true)
  assert.equal(technicalCheck(rows, { [rows[0].source]: '안녕하세요.' }).passed, false)
  assert.equal(technicalCheck(rows, { [rows[0].source]: '<user>' + '가'.repeat(37) }).passed, false)
  assert.equal(technicalCheck(rows, { [rows[0].source]: '<user>こんにちは' }).passed, false)
})

test('durable CLI checkpoints survive restarts, reject premature completion and are idempotent', (t) => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-final-review-test-'))
  t.after(() => {
    const rel = path.relative(path.resolve(os.tmpdir()), path.resolve(root))
    assert.ok(rel.startsWith('abyss-final-review-test-') && !rel.includes(path.sep))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const put = (file, data) => {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, JSON.stringify(data))
  }
  fs.cpSync(path.join(repo, 'docs/translation'), path.join(root, 'docs/translation'), { recursive: true })
  const id = 'hmn_99999999999'
  const cacheFile = path.join(root, '.cache/source.txt')
  put('.cache/source.txt', 'fixture scenario, not production content')
  put('.cache/novel-message-index.json', [
    { novelId: id, cacheFile, line: 1, command: 'message', speaker: 'test', source: 'こんにちは' },
    { novelId: id, cacheFile, line: 2, command: 'message', speaker: 'test', source: 'ありがとう' },
  ])
  put(`translations/novels/${id}/ko_KR.json`, { 'こんにちは': '안녕하세요', 'ありがとう': '고마워요' })
  const run = (...args) => spawnSync(process.execPath, [path.join(repo, 'scripts/final-review-progress.mjs'), ...args], { cwd: root, encoding: 'utf8' })
  const ok = (...args) => {
    const result = run(...args)
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(result.stdout)
  }
  ok('init')
  assert.equal(ok('init').status, 'already-initialized')
  const { snapshot } = ok('prepare', id)
  const report = { id, snapshot, reviewer: 'test fixture', semanticReview: true, ranges: [range(1, 1)], decisions: [], unresolvedBlocking: [], complete: true }
  put('report.json', report)
  assert.notEqual(run('record', 'report.json').status, 0)
  report.complete = false
  put('report.json', report)
  ok('record', 'report.json')
  assert.equal(ok('status', id).items[0].next, 2)
  assert.equal(ok('record', 'report.json').status, 'already-recorded')
  report.ranges = [range(2, 2)]
  report.complete = true
  put('report.json', report)
  assert.equal(ok('record', 'report.json').complete, true)
  assert.equal(ok('prepare', id).status, 'completed')
  assert.equal(ok('status', id).items[0].next, null)
  const checkpoints = path.join(root, 'docs/reviews/final-review/checkpoints')
  fs.writeFileSync(path.join(checkpoints, 'interrupted.tmp'), '{')
  assert.equal(ok('status', id).items[0].status, 'completed')
  fs.appendFileSync(cacheFile, 'changed')
  assert.equal(ok('status', id).items[0].status, 'change-impact-check')
})
