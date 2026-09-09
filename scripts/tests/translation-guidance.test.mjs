import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { compareProtectedTokens } from '../lib/ko-pipeline.mjs'

const dialogue = { lineBreaks: 'korean-dialogue' }

test('novel guidance consistently includes Under and the ruby exception', () => {
  for (const filename of [
    '../docs/translation/final-review.md', '../docs/translation/qa-checklist.md',
    '../docs/new-character-update.md', '../docs/story-novel-check.md',
    'prompts/novels.md',
  ]) {
    const text = fs.readFileSync(new URL('../' + filename, import.meta.url), 'utf8')
    for (const command of ['message', 'dotmessage', 'messageTextCenter', 'messageTextUnder', 'l2dmessage']) {
      assert.ok(text.includes('`' + command + '`'), `${filename}: ${command}`)
    }
  }
  const translator = fs.readFileSync(new URL('../translate-ko.mjs', import.meta.url), 'utf8')
  assert.match(translator, /specific ruby policy overrides generic tag preservation/)
  assert.doesNotMatch(translator, /Japanese text inside tag syntax.*must remain unchanged/)
  const guide = fs.readFileSync(new URL('../../docs/translation/tags-placeholders.md', import.meta.url), 'utf8')
  assert.match(guide, /Novel Ruby Exception/)
  assert.match(guide, /translate both into Korean/)
})

test('novels can consolidate, move, remove, or introduce one line break', () => {
  const pairs = [
    ['first<br>second<br>third', 'first second<br>third'],
    ['first<br>second', 'first second'],
    ['first second', 'first<br>second'],
    ['first\nsecond', 'first<br>second'],
    ['first\\nsecond\\nthird', 'first second<br>third'],
  ]
  for (const [source, target] of pairs) {
    assert.deepEqual(compareProtectedTokens(source, target, dialogue), [])
  }
})

test('novel layout still rejects three lines and protects non-layout tokens', () => {
  assert.ok(compareProtectedTokens('first', 'first<br>second<br>third', dialogue).length)
  const source = '<b><user></b> {0} %s'
  assert.deepEqual(compareProtectedTokens(source, '<b><user></b><br>{0} %s', dialogue), [])
  for (const target of ['<b></b> {0} %s', '<user> {0} %s', '<b><user></b> %s']) {
    assert.ok(compareProtectedTokens(source, target, dialogue).length)
  }
})

test('UI retains its source-break limit', () => {
  assert.ok(compareProtectedTokens('first second', 'first<br>second').length)
  assert.deepEqual(compareProtectedTokens('first<br>second', 'first second'), [])
})

test('the retired strict break policy would reject valid Korean reflow', () => {
  const source = 'first<br>second<br>third'
  const target = 'first second<br>third'
  assert.ok(compareProtectedTokens(source, target, { ...dialogue, preserveLineBreakTokens: true }).length)
  assert.deepEqual(compareProtectedTokens(source, target, dialogue), [])
})

test('review and verification callers use Korean layout policy, not strict source breaks', () => {
  for (const filename of ['review-dialogue-openai.mjs', 'verify-dialogue-suggestions-openai.mjs']) {
    const script = fs.readFileSync(new URL('../' + filename, import.meta.url), 'utf8')
    assert.match(script, /lineBreaks: 'korean-dialogue'/)
    assert.doesNotMatch(script, /preserveLineBreakTokens:\s*true/)
  }
  const translator = fs.readFileSync(new URL('../translate-ko.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(translator, /trimNovelLineBreaks/)
  assert.match(translator, /item\.novelId \? \{ lineBreaks: 'korean-dialogue' \} : \{\}/)
})

test('normalization corrects pickaxe spelling without font-driven synonym rewrites', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-guidance-test-'))
  try {
    const file = path.join(directory, 'translations', 'outgame', 'ko_KR.json')
    const source = {
      '\u30d4\u30c3\u30b1\u30eb': '\uace1\uac31\uc774',
      '\u9244\u306e\u30d4\u30c3\u30b1\u30eb': '\ucca0 \uace1\uad2d\uc774',
      '\u30d4\u30c3\u30b1\u30eb2': '\ud53d\ucf08',
      '\u30d7\u30ed\u30c7\u30e5\u30fc\u30b9': '\ud504\ub85c\ub4c0\uc2a4',
      '\u982d\u3092\u60a9\u307e\u305b\u308b': '\uace8\uba38\ub9ac\ub97c \uc553\uace0 \uc788\ub2e4',
    }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(source))
    const normalizer = fileURLToPath(new URL('../normalize-terminology.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [normalizer], { cwd: directory, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const actual = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.deepEqual(Object.keys(actual), Object.keys(source))
    assert.equal(actual['\u30d4\u30c3\u30b1\u30eb'], '\uace1\uad2d\uc774')
    assert.equal(actual['\u30d4\u30c3\u30b1\u30eb2'], '\uace1\uad2d\uc774')
    for (const key of ['\u9244\u306e\u30d4\u30c3\u30b1\u30eb', '\u30d7\u30ed\u30c7\u30e5\u30fc\u30b9', '\u982d\u3092\u60a9\u307e\u305b\u308b']) {
      assert.equal(actual[key], source[key])
    }
  } finally {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(directory))
    assert.ok(relative.startsWith('abyss-guidance-test-') && !relative.includes(path.sep))
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
