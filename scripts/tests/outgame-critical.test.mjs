import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('../audit-outgame-critical.mjs', import.meta.url))
const commonTranslations = { 'プレゼントボックス': '선물함', '未受け取り数': '미수령 수' }

function fixture(t, entries, translations, changes) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outgame-critical-'))
  t.after(() => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('outgame-critical-'))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  function write(relative, data) {
    const file = path.join(directory, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data), 'utf8')
  }
  write('snapshots/game-cache-ja_JP.json', { entries })
  write('translations/outgame/ko_KR.json', { ...commonTranslations, ...translations })
  if (changes) write('.cache/game-cache-extract-report.json', { changes })
  return {
    write,
    run(...args) {
      const result = spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: 'utf8' })
      assert.equal(result.error, undefined)
      return result
    },
  }
}

test('CLI counts only actual skin serif slots while preserving existing critical tables', t => {
  const f = fixture(t, {
    'm_character_skins/id:101/4': '基本コスチューム',
    'm_character_skins/id:101/5': '基本コスチュームの説明です。',
    'm_character_skins/id:101/6': '任せてください。',
    'm_character_skins/id:102/6': '任せてください。',
    'm_character_skins/id:103/6': 'よろしくお願いします。',
    'm_characters/id:10/1': 'キャラクター名',
    'm_event_top_characters/id:1/6': 'イベントの台詞です。',
    'm_unrelated/id:1/6': '対象外です。',
  }, {
    '任せてください。': '맡겨 주세요.',
    'よろしくお願いします。': '잘 부탁드립니다.',
    'イベントの台詞です。': '이벤트 대사입니다.',
  })
  const result = f.run()
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /checked=6 issues=0/)
  assert.match(result.stdout, /m_character_skins: checked=3 issues=0/)
  assert.match(result.stdout, /m_event_top_characters: checked=1 issues=0/)
  assert.doesNotMatch(result.stdout, /m_characters:|m_unrelated:/)
})

test('CLI rejects missing, empty, source-equal and mixed Japanese skin values', t => {
  const sources = ['未登録の台詞。', '原文の台詞。', '空の台詞。', '空白の台詞。', '仮名の台詞。', '漢字の台詞。', 'タグの台詞。']
  const entries = Object.fromEntries(sources.map((source, i) => [`m_character_skins/id:${i + 1}/6`, source]))
  const f = fixture(t, entries, {
    [sources[1]]: sources[1],
    [sources[2]]: '',
    [sources[3]]: ' \t\n',
    [sources[4]]: '한국어です',
    [sources[5]]: '초可愛的폭력소녀',
    [sources[6]]: '<sprite name="可愛">한국어・표기',
  })
  const result = f.run()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /m_character_skins: checked=7 issues=6/)
  assert.match(result.stdout, /\[missing\] m_character_skins\/id:1\/6/)
  assert.match(result.stdout, /\[untranslated\] m_character_skins\/id:2\/6/)
  assert.match(result.stdout, /\[empty\] m_character_skins\/id:3\/6/)
  assert.match(result.stdout, /\[empty\] m_character_skins\/id:4\/6/)
  assert.match(result.stdout, /\[japanese-leftover\] m_character_skins\/id:5\/6/)
  assert.match(result.stdout, /\[japanese-leftover\] m_character_skins\/id:6\/6/)
  assert.doesNotMatch(result.stdout, /\] m_character_skins\/id:7\/6/)
})

test('CLI also rejects empty translations in existing table and hardcoded UI checks', t => {
  const f = fixture(t, { 'm_event_top_characters/id:1/6': '既存の台詞です。' }, {
    '既存の台詞です。': '',
    '未受け取り数': ' ',
  })
  const result = f.run()
  assert.equal(result.status, 1)
  assert.match(result.stdout, /checked=3 issues=2/)
  assert.match(result.stdout, /\[empty\] m_event_top_characters\/id:1\/6/)
  assert.match(result.stdout, /\[empty\] hardcoded-ui\/未受け取り数/)
})

test('added-only uses changed after sources and excludes unchanged, removed and non-serif slots', t => {
  const oldSkin = '旧スキン台詞。', newSkin = '新スキン台詞。', addedSkin = '追加スキン台詞。'
  const oldEvent = '旧イベント台詞。', newEvent = '新イベント台詞。'
  const translations = { [newSkin]: '새 스킨 대사.', [addedSkin]: '추가 스킨 대사.', [newEvent]: '새 이벤트 대사.' }
  const f = fixture(t, {
    'm_character_skins/id:1/6': oldSkin,
    'm_character_skins/id:2/6': addedSkin,
    'm_character_skins/id:3/6': '変更なし未翻訳。',
    'm_character_skins/id:4/6': '削除された台詞。',
    'm_character_skins/id:1/4': '旧名前。',
    'm_character_skins/id:2/5': '説明です。',
    'm_event_top_characters/id:1/6': oldEvent,
  }, translations, {
    added: [
      { location: 'm_character_skins/id:2/6', source: addedSkin },
      { location: 'm_character_skins/id:2/5', source: '説明です。' },
    ],
    changed: [
      { location: 'm_character_skins/id:1/6', before: oldSkin, after: newSkin },
      { location: 'm_character_skins/id:1/4', before: '旧名前。', after: '新名前。' },
      { location: 'm_event_top_characters/id:1/6', before: oldEvent, after: newEvent },
    ],
    removed: [{ location: 'm_character_skins/id:4/6', source: '削除された台詞。' }],
  })
  const result = f.run('--added-only')
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /scope=added-or-changed checked=5 issues=0/)
  assert.match(result.stdout, /m_character_skins: checked=2 issues=0/)
  assert.match(result.stdout, /m_event_top_characters: checked=1 issues=0/)

  f.write('translations/outgame/ko_KR.json', { ...commonTranslations, ...translations, [newSkin]: newSkin })
  const untranslated = f.run('--added-only')
  assert.equal(untranslated.status, 1)
  assert.match(untranslated.stdout, /\[untranslated\] m_character_skins\/id:1\/6/)
  assert.match(untranslated.stdout, /新スキン台詞/)
  assert.doesNotMatch(untranslated.stdout, /旧スキン台詞/)
})

test('no-fail preserves findings while overriding the failure exit code', t => {
  const f = fixture(t, { 'm_character_skins/id:1/6': '未登録です。' }, {})
  const result = f.run('--no-fail')
  assert.equal(result.status, 0)
  assert.match(result.stdout, /m_character_skins: checked=1 issues=1/)
  assert.match(result.stdout, /\[missing\]/)
})
