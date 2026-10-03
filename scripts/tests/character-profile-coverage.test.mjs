import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PROFILE_FIELDS, auditProfileCoverage, effectiveUiValue, parseArgs, runAudit, selectProfileSources, translationState } from '../audit-character-profile-coverage.mjs'

const sources = { '2': 'プロフィールです。', '3': '異名です。', '4': '好きなものです。', '5': '嫌いなものです。', '7': '決め台詞です。' }
const values = { '2': '프로필입니다.', '3': '이명입니다.', '4': '좋아하는 것입니다.', '5': '싫어하는 것입니다.', '7': '대표 대사입니다.' }
function fixture(ids = ['300028']) {
  const snapshot = { entries: {} }
  const repo = { another_name: {}, descriptions: {}, outgame: {}, static: { m_character_profiles: {} } }
  for (const id of ids) for (const [slot, source] of Object.entries(sources)) {
    snapshot.entries[`m_character_profiles/id:${id}/${slot}`] = source
    const field = PROFILE_FIELDS[slot]
    repo[field === 'another_name' ? 'another_name' : 'descriptions'][source] = values[slot]
    repo.outgame[source] = values[slot]
    repo.static.m_character_profiles[field] ??= {}
    repo.static.m_character_profiles[field][source] = values[slot]
  }
  return { snapshot, profileIds: ids, repo }
}

test('all five verified profile fields require their actual flat/outgame/static paths', () => {
  const input = fixture()
  input.repo.descriptions = { [sources['2']]: values['2'] }
  input.repo.another_name = {}
  input.repo.outgame = { [sources['2']]: values['2'] }
  input.repo.static.m_character_profiles = { flavor_text: { [sources['2']]: values['2'] } }
  const report = auditProfileCoverage(input)
  assert.equal(report.counts.sourceLocations, 5)
  assert.equal(report.counts.repoCoveredLocations, 1)
  assert.equal(report.findings.filter(f => f.scope === 'repo').length, 12)
  assert.equal(report.ok, false)
})

test('a translated alias in descriptions cannot replace the alias dictionary', () => {
  const input = fixture()
  input.repo.descriptions[sources['3']] = values['3']
  delete input.repo.another_name[sources['3']]
  const report = auditProfileCoverage(input)
  assert.ok(report.findings.some(f => f.field === 'another_name' && f.layer === 'another_name' && f.code === 'missing'))
  assert.equal(report.counts.repoCoveredLocations, 4)
})

test('empty selection, unknown IDs, conflicting flags and require-game without a root fail', () => {
  const input = fixture()
  assert.throws(() => selectProfileSources(input.snapshot, { profileIds: [] }), /Select exactly one/)
  assert.throws(() => selectProfileSources(input.snapshot, { profileIds: ['999'] }), /absent from snapshot/)
  assert.throws(() => parseArgs(['--profile-ids', '']), /non-empty/)
  assert.throws(() => parseArgs(['--profile-ids', '300028,']), /positive numeric/)
  assert.throws(() => parseArgs(['--all', '--profile-ids', '300028']), /Select exactly one/)
  assert.throws(() => parseArgs(['--all', '--require-game']), /needs --game-root/)
  input.snapshot.entries['m_character_profiles/id:999/1'] = 'unmapped'
  assert.throws(() => selectProfileSources(input.snapshot, { profileIds: ['300028', '999'] }), /no non-empty mapped/)
})

test('static cross-field copies do not inflate the five actual source locations', () => {
  const input = fixture()
  for (const field of Object.values(PROFILE_FIELDS)) for (const [slot, source] of Object.entries(sources)) input.repo.static.m_character_profiles[field][source] = values[slot]
  const report = auditProfileCoverage(input)
  assert.equal(report.counts.sourceLocations, 5)
  assert.equal(report.counts.uniqueSourceStrings, 5)
  assert.equal(report.counts.repoCoverageSlots, 15)
  assert.equal(report.ok, true)
})

test('copies in the wrong static field do not satisfy the actual source-field path', () => {
  const input = fixture()
  delete input.repo.static.m_character_profiles.catchphrase[sources['7']]
  input.repo.static.m_character_profiles.flavor_text[sources['7']] = values['7']
  const report = auditProfileCoverage(input)
  assert.ok(report.findings.some(f => f.field === 'catchphrase' && f.layer.endsWith('.catchphrase') && f.code === 'missing'))
})

test('a higher Japanese source value shadows a ready persistent local translation', () => {
  const input = fixture()
  input.game = { outgame: { [sources['2']]: sources['2'] }, local: { ...input.repo.outgame }, static: input.repo.static }
  input.requireGame = true
  const report = auditProfileCoverage(input)
  assert.equal(report.rows[0].game.effective.layer, 'outgame')
  assert.equal(report.rows[0].game.effective.status, 'untranslated')
  assert.equal(report.counts.gameUiCoveredLocations, 4)
  assert.equal(report.gameStatic.coveredLocations, 5)
  assert.equal(report.ok, false)
})

test('ready local values satisfy require-game when higher dictionaries have no key', () => {
  const input = fixture()
  input.game = { outgame: {}, names: {}, titles: {}, descriptions: {}, local: { ...input.repo.outgame }, static: {} }
  input.requireGame = true
  const report = auditProfileCoverage(input)
  assert.equal(report.counts.gameUiCoveredLocations, 5)
  assert.equal(report.gameStatic.missingLocations, 5)
  assert.equal(report.ok, true)
})

test('lookup order respects Names before Titles/Descriptions/local and presence of empty values', () => {
  const game = { names: { key: '' }, titles: { key: '제목' }, descriptions: { key: '설명' }, local: { key: '로컬' } }
  assert.deepEqual(effectiveUiValue(game, 'key'), { status: 'empty', present: true, value: '', layer: 'names' })
  delete game.names.key
  assert.equal(effectiveUiValue(game, 'key').layer, 'titles')
})

test('repeated source strings retain distinct source locations without unique-string overcount', () => {
  const input = fixture(['300028', '300036'])
  input.profileIds.push('300028')
  const report = auditProfileCoverage(input)
  assert.equal(report.selection.profileIds.length, 2)
  assert.equal(report.counts.sourceLocations, 10)
  assert.equal(report.counts.uniqueSourceStrings, 5)
  assert.equal(report.counts.repoCoverageSlots, 30)
  assert.equal(report.counts.repoCoveredLocations, 10)
})

test('empty, source-equal, kana-mixed and flat/static mismatched values are separate findings', () => {
  const input = fixture()
  input.repo.descriptions[sources['2']] = ' '
  input.repo.another_name[sources['3']] = sources['3']
  input.repo.outgame[sources['4']] = '좋아하는もの'
  input.repo.static.m_character_profiles.profile_dislike[sources['5']] = '다른 설명'
  const report = auditProfileCoverage(input)
  assert.deepEqual(new Set(report.findings.map(f => f.code)), new Set(['empty', 'untranslated', 'japanese-remaining', 'value-mismatch']))
  assert.equal(report.ok, false)
})

test('kana detection catches half-width mixtures while allowing shared punctuation and tag attributes', () => {
  assert.equal(translationState({ source: '한국어・표기' }, 'source').status, 'translated')
  assert.equal(translationState({ source: '한국어ﾓﾉ' }, 'source').status, 'japanese-remaining')
  assert.equal(translationState({ source: '<sprite name="カナ">한국어' }, 'source').status, 'translated')
})

test('unprotected mixed Han text is rejected while protected tag attributes remain valid', () => {
  assert.equal(translationState({ source: '초可愛的폭력소녀' }, 'source').status, 'japanese-remaining')
  assert.equal(translationState({ source: '<sprite name="可愛">한국어・표기' }, 'source').status, 'translated')
})

test('require-game demands effective UI equality to the selected root value', () => {
  const input = fixture()
  input.game = { local: { ...input.repo.outgame, [sources['2']]: '다른 프로필' } }
  input.requireGame = true
  const report = auditProfileCoverage(input)
  assert.ok(report.findings.some(f => f.scope === 'game-ui' && f.code === 'value-mismatch'))
  assert.equal(report.ok, false)
  assert.equal(auditProfileCoverage({ ...input, requireGame: false }).ok, true)
})

test('the shared canonical terminology gate catches an approved-name violation', () => {
  const input = fixture()
  const location = 'm_character_profiles/id:300028/3'
  input.snapshot.entries[location] = 'ヒマリ'
  input.repo.another_name['ヒマリ'] = '히말리'
  input.repo.outgame['ヒマリ'] = '히말리'
  input.repo.static.m_character_profiles.another_name['ヒマリ'] = '히말리'
  const report = auditProfileCoverage(input)
  assert.ok(report.findings.some(f => f.location === location && f.code === 'canonical-terminology'))
  assert.equal(report.ok, false)
})

function diskFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-profile-coverage-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const input = fixture()
  const write = (relative, object) => {
    const file = path.join(root, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(object), 'utf8')
    return file
  }
  write('snapshots/game-cache-ja_JP.json', input.snapshot)
  for (const [layer, object] of Object.entries(input.repo)) write(`translations/${layer}/ko_KR.json`, object)
  return { root, input, write }
}

test('file audit reports missing/empty layers while persistent local ready values can pass', t => {
  const { root, input, write } = diskFixture(t)
  write('game/config/AbyssMod/outgame-ko_KR.json', input.repo.outgame)
  write('game/plugins/AbyssMod/cache/ko_KR/outgame.json', {})
  const report = runAudit({ root, profileIds: ['300028'], gameRoot: 'game', requireGame: true })
  assert.equal(report.ok, true)
  assert.ok(report.findings.some(f => f.code === 'missing-dictionary' && f.layer === 'game.names'))
  assert.ok(report.findings.some(f => f.code === 'empty-dictionary' && f.layer === 'game.outgame'))
})

test('malformed dictionaries fail rather than silently behaving like missing dictionaries', t => {
  const { root, write } = diskFixture(t)
  const file = write('translations/descriptions/ko_KR.json', {})
  fs.writeFileSync(file, '{invalid', 'utf8')
  assert.throws(() => runAudit({ root, profileIds: ['300028'] }), /Invalid JSON/)
  fs.writeFileSync(file, '[]', 'utf8')
  assert.throws(() => runAudit({ root, profileIds: ['300028'] }), /JSON object/)
})

test('all mode uses only observed mapped fields and states raw-row inventory limits', () => {
  const input = fixture()
  input.snapshot.entries['m_character_profiles/id:300028/1'] = 'numeric reference excluded'
  const report = auditProfileCoverage({ ...input, profileIds: undefined, all: true })
  assert.equal(report.counts.sourceLocations, 5)
  assert.ok(report.limitations.some(s => s.includes('raw-row inventory')))
})

test('CLI writes the requested report and importing the module has no execution side effects', t => {
  const { root } = diskFixture(t)
  const script = fileURLToPath(new URL('../audit-character-profile-coverage.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script, '--root', root, '--profile-ids', '300028', '--json-out', 'report/result.json'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(fs.readFileSync(path.join(root, 'report/result.json'), 'utf8'))
  assert.equal(report.counts.sourceLocations, 5)
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../audit-character-profile-coverage.mjs', import.meta.url).href)})`], { encoding: 'utf8', cwd: root })
  assert.equal(imported.status, 0, imported.stderr)
  assert.equal(imported.stdout, '')
  assert.equal(imported.stderr, '')
})
