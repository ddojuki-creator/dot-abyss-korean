import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import {auditSkinCoverage, selectSkinRows, runSkinAudit} from '../audit-character-skin-coverage.mjs'

function fixture() {
  const skin = [101, 1, 1, 2, 'テスト衣装', 'テストの衣装です。', 'ま、毎度ありがとうございます！\n配達です……']
  const translations = {[skin[4]]: '테스트 의상', [skin[5]]: '테스트 의상이다.', [skin[6]]: '매, 매번 감사드립니다!\n배달 왔어요……'}
  return {
    master: {m_characters: [[1, 'テスト']], m_character_skins: [skin]}, skinIds: [101],
    snapshot: {entries: Object.fromEntries([4, 5, 6].map(slot => [`m_character_skins/id:101/${slot}`, skin[slot]]))},
    repo: {names: {[skin[4]]: translations[skin[4]]}, descriptions: {[skin[5]]: translations[skin[5]]}, outgame: translations, static: {m_character_skins: {name: {[skin[4]]: translations[skin[4]]}, description: {[skin[5]]: translations[skin[5]]}, serif: {[skin[6]]: translations[skin[6]]}}}},
  }
}

test('costume name, description and acquisition line are three required source fields', () => {
  const f = fixture()
  assert.equal(auditSkinCoverage(f).ok, true)
  delete f.repo.outgame[f.master.m_character_skins[0][4]]
  assert.ok(auditSkinCoverage(f).findings.some(row => row.field === 'name' && row.layer === 'outgame' && row.code === 'missing'))
})

test('a translation copied into a wrong static field cannot cover the actual serif field', () => {
  const f = fixture(), source = f.master.m_character_skins[0][6]
  f.repo.static.m_character_skins.name[source] = f.repo.outgame[source]
  delete f.repo.static.m_character_skins.serif[source]
  assert.ok(auditSkinCoverage(f).findings.some(row => row.field === 'serif' && row.layer.endsWith('.serif') && row.code === 'missing'))
})

test('all linked work skins count as rows while reused acquisition lines count once', () => {
  const f = fixture(), second = [...f.master.m_character_skins[0]]
  second[0] = 102; second[2] = 2; f.master.m_character_skins.push(second)
  for (const slot of [4, 5, 6]) f.snapshot.entries[`m_character_skins/id:102/${slot}`] = second[slot]
  const report = auditSkinCoverage({...f, skinIds: [], characterIds: [1]})
  assert.equal(report.ok, true); assert.equal(report.counts.skins, 2)
  assert.equal(report.counts.acquisitionLocations, 2); assert.equal(report.counts.uniqueAcquisitionLines, 1)
})

test('an actually empty acquisition field is recorded rather than invented or called translated', () => {
  const f = fixture(); f.master.m_character_skins[0][6] = ''
  const report = auditSkinCoverage(f)
  assert.equal(report.ok, true); assert.equal(report.counts.blankFields, 1)
  assert.equal(report.counts.acquisitionLocations, 0); assert.equal(report.blanks[0].field, 'serif')
})

test('stored Korean does not pass the installed gate when a higher source value shadows local Korean', () => {
  const f = fixture(), source = f.master.m_character_skins[0][6]
  const game = {outgame: {...f.repo.outgame, [source]: source}, local: f.repo.outgame, static: f.repo.static}
  const report = auditSkinCoverage({...f, game, requireGame: true})
  assert.equal(report.ok, false)
  assert.ok(report.findings.some(row => row.scope === 'game-ui' && row.field === 'serif' && row.code === 'untranslated' && row.layer === 'outgame'))
})

test('observed br variant needs its exact key and obeys the UI source-break limit', () => {
  const f = fixture(), raw = f.master.m_character_skins[0][6], variant = raw.replace('\n', '<br>'), collected = {[variant]: variant}
  assert.ok(auditSkinCoverage({...f, collected}).findings.some(row => row.source === variant && row.code === 'missing'))
  f.repo.outgame[variant] = f.repo.outgame[raw] + '\n'
  assert.ok(auditSkinCoverage({...f, collected}).findings.some(row => row.source === variant && row.code === 'protected-tokens'))
  f.repo.outgame[variant] = f.repo.outgame[raw]
  assert.equal(auditSkinCoverage({...f, collected}).ok, true)
})

test('raw reference and snapshot mismatches fail instead of guessing ownership', () => {
  const f = fixture()
  assert.throws(() => selectSkinRows(f.master, {skinIds: [999]}), /no matching/)
  assert.throws(() => selectSkinRows(f.master, {skinIds: [101], all: true}), /exactly one/)
  f.snapshot.entries['m_character_skins/id:101/6'] = '別の台詞'
  assert.throws(() => auditSkinCoverage(f), /Snapshot differs/)
  f.master.m_character_skins[0][1] = 2
  assert.throws(() => selectSkinRows(f.master, {skinIds: [101]}), /Unknown skin owner/)
})

test('explicit snapshot, config and collection paths retain their loaded contents', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abyssmod-skin-input-test-'))
  // Independent minimal MessagePack fixture: maps, arrays, strings and fixints.
  const encode = value => {
    if (typeof value === 'number') { assert.ok(value >= 0 && value < 128); return Buffer.from([value]) }
    if (typeof value === 'string') { const b = Buffer.from(value); assert.ok(b.length < 256); return Buffer.concat([Buffer.from(b.length < 32 ? [0xa0 + b.length] : [0xd9, b.length]), b]) }
    if (Array.isArray(value)) { assert.ok(value.length < 16); return Buffer.concat([Buffer.from([0x90 + value.length]), ...value.map(encode)]) }
    const entries = Object.entries(value); assert.ok(entries.length < 16)
    return Buffer.concat([Buffer.from([0x80 + entries.length]), ...entries.flatMap(([key, item]) => [encode(key), encode(item)])])
  }
  try {
    const f = fixture(), bytes = encode(f.master), variant = f.master.m_character_skins[0][6].replace('\n', '<br>')
    f.repo.outgame[variant] = f.repo.outgame[f.master.m_character_skins[0][6]]
    const write = (file, data) => { const target = path.join(directory, file); fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(target, JSON.stringify(data)) }
    fs.writeFileSync(path.join(directory, 'master.dat'), bytes)
    write('source.json', {...f.snapshot, cacheSha256: crypto.createHash('sha256').update(bytes).digest('hex')})
    write('mapping.json', {tables: {m_character_skins: {name: true, description: true, serif: true}}})
    write('captured.json', {[variant]: variant})
    for (const [layer, data] of Object.entries(f.repo)) write(`translations/${layer}/ko_KR.json`, data)
    const report = runSkinAudit({root: directory, masterCache: 'master.dat', snapshot: 'source.json', masterConfig: 'mapping.json', collected: 'captured.json', skinIds: [101]})
    assert.equal(report.ok, true)
    assert.ok(report.records.find(row => row.field === 'serif').cases.some(item => item.source === variant && item.observed && item.kind === 'collected-linebreak-variant'))
  } finally {
    const resolved = path.resolve(directory)
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('abyssmod-skin-input-test-'))
    fs.rmSync(resolved, {recursive: true, force: true})
  }
})
