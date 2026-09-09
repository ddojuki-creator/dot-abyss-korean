import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePlan, matchingCopies, checkStory, qaJobs } from '../final-review-workflow.mjs'

const plan = () => ({ modelPolicy: 'inherit-current', lanes: [
  { id: 'one', character: 'one', novels: ['hmn_10090100003'] },
  { id: 'two', character: 'two', novels: ['hmn_10100100001'] },
] })

test('parallel plan inherits model and has exclusive character files', () => {
  assert.equal(validatePlan(plan()).length, 2)
  const duplicate = plan()
  duplicate.lanes[1].novels.push('hmn_10090100003')
  assert.throws(() => validatePlan(duplicate), /Overlapping/)
})

test('plan rejects model switch, invalid IDs and invalid declared limits', () => {
  assert.throws(() => validatePlan({ ...plan(), modelPolicy: 'fast' }))
  const bad = plan()
  bad.lanes[0].novels = ['../../other']
  assert.throws(() => validatePlan(bad))
  assert.throws(() => validatePlan({ ...plan(), lanes: Array(4).fill(plan().lanes[0]) }))
  for (const maxParallelAgents of [0, -1, 1.5, '4', 1]) {
    assert.throws(() => validatePlan({ ...plan(), maxParallelAgents }))
  }
})

test('main-story IDs use the same exclusive ordinary-story plan', () => {
  const main = plan()
  main.lanes[0].novels = ['mas_1001000101', 'mas_1001000201']
  assert.equal(validatePlan(main).length, 3)
  main.lanes[1].novels.push('mas_1001000101')
  assert.throws(() => validatePlan(main), /Overlapping/)
})

test('main-story support does not accept adult stories or malformed ID lengths', () => {
  for (const id of ['hmr_10010100011', 'mas_100100010', 'mas_10010001011', 'men_1001000101', '../mas_1001000101']) {
    const invalid = plan()
    invalid.lanes[0].novels = [id]
    assert.throws(() => validatePlan(invalid), /ordinary story ID/)
  }
})

test('prepared four-agent plan accepts three story lanes and one common owner', () => {
  const expanded = {
    ...plan(), maxParallelAgents: 4,
    lanes: [
      ...plan().lanes,
      { id: 'three', kind: 'novels', character: 'three', novels: ['hmn_10580100001'] },
      { id: 'ui', kind: 'common', domains: ['outgame', 'static'], start: { domain: 'outgame', offset: 2893, limit: 40 } },
    ],
  }
  assert.equal(validatePlan(expanded).length, 5)
  assert.throws(() => validatePlan({ ...expanded, maxParallelAgents: 3 }))
  const extra = { id: 'four', character: 'four', novels: ['hmn_10600100001'] }
  assert.equal(validatePlan({ ...expanded, maxParallelAgents: 5, lanes: [...expanded.lanes, extra] }).length, 6)
  const ui = expanded.lanes[3]
  assert.throws(() => validatePlan({ ...expanded, maxParallelAgents: 5, lanes: [...expanded.lanes, { ...ui, id: 'ui-two' }] }), /Overlapping/)
  assert.throws(() => validatePlan({ ...expanded, lanes: [...expanded.lanes.slice(0, 3), { ...ui, domains: ['outgame', 'outgame'] }] }), /Overlapping/)
})

test('common ownership rejects unknown domains and invalid selection bounds', () => {
  const ui = { id: 'ui', kind: 'common', domains: ['outgame'], start: { domain: 'outgame', offset: 1, limit: 40 } }
  for (const change of [
    { domains: ['manifest'] }, { domains: [] }, { novels: ['hmn_10090100003'] },
    { start: null }, { start: { domain: 'static', offset: 1, limit: 40 } },
    { start: { domain: 'outgame', offset: 0, limit: 40 } },
    { start: { domain: 'outgame', offset: 1, limit: 101 } },
  ]) assert.throws(() => validatePlan({ modelPolicy: 'inherit-current', lanes: [{ ...ui, ...change }] }))
  assert.throws(() => validatePlan({ ...plan(), lanes: [{ ...plan().lanes[0], kind: 'unknown' }] }))
})

test('exact-copy lookup keeps different table paths and domains', () => {
  const result = matchingCopies(['same'], [
    { domain: 'titles', data: { same: 'value' } },
    { domain: 'static', data: { a: { same: 'value' }, b: { same: 'value' }, other: 'same' } },
  ])
  assert.equal(result.length, 3)
  assert.deepEqual(result.map((r) => r.path), [['same'], ['a', 'same'], ['b', 'same']])
  assert.throws(() => matchingCopies([], []))
})

const snapshot = () => ({ originalTranslations: { source: 'old', other: 'old' }, rows: [
  { position: 1, source: 'source' }, { position: 2, source: 'source' }, { position: 3, source: 'other' },
] })

test('focused check is not semantic approval and requires repeated-key coverage', () => {
  const data = { source: 'new', other: 'old' }
  assert.equal(checkStory(snapshot(), data, [1]).passed, false)
  const result = checkStory(snapshot(), data, [1, 2])
  assert.equal(result.passed, true)
  assert.equal(result.semanticReview, false)
  assert.equal(result.changedKeys, 1)
  assert.equal(result.checkedOccurrences, 2)
})

test('focused check rejects key changes, invalid ranges and broken tokens', () => {
  assert.equal(checkStory(snapshot(), { source: 'old' }).passed, false)
  assert.throws(() => checkStory(snapshot(), {}, [0]))
  assert.throws(() => checkStory(snapshot(), {}, []))
  assert.throws(() => checkStory(snapshot(), {}, [1, 1]))
  const s = { originalTranslations: { '<user>': '<user>' }, rows: [{ position: 1, source: '<user>' }] }
  assert.equal(checkStory(s, { '<user>': 'lost' }).passed, false)
  assert.equal(checkStory(snapshot(), { source: 'x'.repeat(37), other: 'old' }).passed, false)
})

test('full QA is sequential audit configuration, without publishing or generation', () => {
  const jobs = qaJobs()
  assert.ok(jobs.some(([name]) => name.includes('audit-static-bundle')))
  assert.ok(jobs.some(([name]) => name === '--test'))
  assert.ok(jobs.every((job) => !job.some((arg) => /publish|update-manifest|--write|push/.test(arg))))
})
