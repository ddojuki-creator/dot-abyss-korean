import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { sha } from '../final-review-progress.mjs'
import { entryProgress, diagnostics, validateDecisions } from '../common-review-progress.mjs'

const row = { path: ['table', 'name', '名前'], key: '名前', value: '이름' }
const snapshot = { domain: 'static', rows: [row] }
const report = (decisions) => ({ semanticReview: true, reviewer: 'test', context: 'source and field', decisions })
const keep = { position: 1, action: 'keep', reason: 'correct label' }
const record = { id: sha(['static', row.path]), translationSha256: sha([row.path, row.value]), instructionsSha256: 'rules', action: 'keep' }
test('completed entry skips unrelated file edits', () => assert.equal(entryProgress('static', row, 'rules', [record]), 'completed'))
test('edited value requires impact check', () => assert.equal(entryProgress('static', { ...row, value: '명칭' }, 'rules', [record]), 'change-impact-check'))
test('different table path is a different entry', () => assert.equal(entryProgress('static', { ...row, path: ['other', ...row.path] }, 'rules', [record]), 'pending'))
test('different domain is a different entry', () => assert.equal(entryProgress('outgame', row, 'rules', [record]), 'pending'))
test('rule change preserves completion history', () => assert.equal(entryProgress('static', row, 'new', [record]), 'rule-impact-check'))
test('hold is not completion', () => assert.equal(entryProgress('static', row, 'rules', [{ ...record, action: 'hold' }]), 'hold'))
test('new hold revokes earlier completion without deleting history', () => assert.equal(entryProgress('static', row, 'rules', [record, { ...record, action: 'hold', recordedAt: '2026-09-05T12:00:00Z' }]), 'hold'))
test('explicit evidence required', () => assert.throws(() => validateDecisions(snapshot, { decisions: [keep] }, [row]), /evidence/))
test('duplicate positions rejected', () => assert.throws(() => validateDecisions(snapshot, report([keep, keep]), [row]), /duplicate/))
test('source keys cannot be renamed', () => assert.throws(() => validateDecisions(snapshot, report([keep]), [{ ...row, path: ['different'] }]), /key/))
test('unreported edit rejected', () => assert.throws(() => validateDecisions(snapshot, report([keep]), [{ ...row, value: '명칭' }]), /current value/))
test('documented edit accepted', () => assert.equal(validateDecisions(snapshot, report([{ ...keep, action: 'change', after: '명칭' }]), [{ ...row, value: '명칭' }])[0].after, '명칭'))
test('numeric difference flagged', () => assert.ok(diagnostics({ key: '10秒' }, '20초').includes('numeric-difference-review')))
test('missing placeholder requires explicit disposition', () => assert.ok(diagnostics({ key: '名前{0}' }, '이름').length > 0))
test('additional static color is flagged, not silently accepted', () => assert.ok(diagnostics(row, '<color=#6B8CFF>이름</color>').length > 0))
test('empty value cannot be completed', () => assert.throws(() => validateDecisions({ ...snapshot, rows: [{ ...row, value: '' }] }, report([keep]), [{ ...row, value: '' }]), /warnings/))
test('unrelated current entries need not be re-reviewed', () => assert.equal(validateDecisions(snapshot, report([keep]), [row, { path: ['other'], key: 'other', value: '기타' }]).length, 1))

test('common CLI resumes after interruption, skips completed keys and records once', (t) => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-common-review-test-'))
  t.after(() => {
    const rel = path.relative(path.resolve(os.tmpdir()), path.resolve(root))
    assert.ok(rel.startsWith('abyss-common-review-test-') && !rel.includes(path.sep))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const put = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), JSON.stringify(data))
  }
  fs.cpSync(path.join(repo, 'docs/translation'), path.join(root, 'docs/translation'), { recursive: true })
  for (const file of ['outgame-update-qa.md', 'new-character-update.md']) fs.copyFileSync(path.join(repo, 'docs', file), path.join(root, 'docs', file))
  for (const domain of ['names', 'titles', 'descriptions', 'another_name', 'ability_descriptions', 'outgame', 'static']) put(`translations/${domain}/ko_KR.json`, { '名前': '이름', '説明': '설명' })
  const run = (...args) => spawnSync(process.execPath, [path.join(repo, 'scripts/common-review-progress.mjs'), ...args], { cwd: root, encoding: 'utf8' })
  const ok = (...args) => { const r = run(...args); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout) }
  const prepared = ok('prepare', 'names', '1')
  const draft = { ...report([keep]), snapshot: prepared.snapshot }
  put('report.json', draft)
  ok('record', 'report.json')
  assert.equal(ok('record', 'report.json').status, 'already-recorded')
  assert.equal(ok('prepare', 'names', '1').rows[0].key, '説明')
  put('translations/names/ko_KR.json', { '名前': '이름', '説明': '새 설명' })
  fs.writeFileSync(path.join(root, 'docs/reviews/final-review/common/checkpoints/interrupted.tmp'), '{')
  assert.equal(ok('status')[0].counts.completed, 1)
  put('translations/names/ko_KR.json', { '名前': '명칭', '説明': '새 설명' })
  assert.equal(ok('status')[0].counts['change-impact-check'], 1)
  assert.equal(ok('reconcile', 'names', '1').rows[0].key, '名前')
  assert.notEqual(run('record', 'report.json').status, 0)
  put('translations/names/ko_KR.json', { '別名': '별명', '説明': '새 설명' })
  assert.equal(ok('status')[0].removedReviewedKeys, 1)
})
