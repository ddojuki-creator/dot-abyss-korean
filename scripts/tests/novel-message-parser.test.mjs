import assert from 'node:assert/strict'
import test from 'node:test'
import { MESSAGE_COMMANDS, parseMessageLine, extractMessageRecords } from '../lib/novel-message-parser.mjs'

test('recognizes each verified display command without changing source text', () => {
  for (const command of MESSAGE_COMMANDS) {
    assert.deepEqual(parseMessageLine(command + ',<user>,本文<br>二行目,,,on', 7), {
      line: 7, command, speaker: '<user>', source: '本文<br>二行目', voice: null, chara: null,
    })
  }
})

test('under text preserves commas, quotation marks and embedded tags', () => {
  const source = '『前線基地という名前は立派だが、<br>寄せ集めの兵たちが集まっている、仮設防衛拠点でしかない』'
  assert.equal(parseMessageLine('messageTextUnder,<user>,' + source + ',,,on', 251).source, source)
  assert.equal(parseMessageLine('messageTextUnder,,a,b<br>c,,,off', 3).source, 'a,b<br>c')
})

test('under text retains voice and character metadata separately', () => {
  const row = parseMessageLine('messageTextUnder,話者,本文,1033010000,vc_103301_001,1/chara_103301', 9)
  assert.equal(row.source, '本文')
  assert.equal(row.voice, 'vc_103301_001')
  assert.equal(row.chara, '1/chara_103301')
  assert.equal(row.speaker, '話者')
})

test('ordinary and live2d legacy metadata stripping is unchanged', () => {
  assert.equal(parseMessageLine('message,話者,本文,123456', 1).source, '本文')
  assert.equal(parseMessageLine('l2dmessage,話者,本文,,vc_scene_001,ALLON', 2).source, '本文')
  assert.equal(parseMessageLine('messageTextCenter,,<size=30>本文</>,,,on', 3).source, '<size=30>本文</>')
})

test('dotmessage keeps its separate metadata boundary', () => {
  assert.equal(parseMessageLine('dotmessage,話者,本文,,animation,on', 1).source, '本文')
  assert.equal(parseMessageLine('dotmessage,話者,本文,animation', 2).source, '本文')
})

test('ignores unrelated commands, incomplete records and command-like substrings', () => {
  for (const line of ['messageTextUnder', 'messageTextUnder,actor', 'messageTextUnder,actor,,,on',
    'messageTextUnderClear,actor,text', '//messageTextUnder,,text', 'effect,,messageTextUnder,text']) {
    assert.equal(parseMessageLine(line, 1), null)
  }
})

test('records source line numbers, repeated occurrences and exact cache identity', () => {
  const script = 'label,start\r\nmessageTextUnder,,同じ,,,on\r\n\r\nmessage,,同じ,,,on\r\n'
  const rows = extractMessageRecords(script, 'hmn_10330100001', 'cache/__data')
  assert.deepEqual(rows.map(r => [r.line, r.command, r.source]), [[2, 'messageTextUnder', '同じ'], [4, 'message', '同じ']])
  assert.ok(rows.every(r => r.novelId === 'hmn_10330100001' && r.cacheFile === 'cache/__data'))
  assert.deepEqual(extractMessageRecords(null, 'unused', 'unused'), [])
})
