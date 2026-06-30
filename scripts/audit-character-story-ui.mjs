#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue } from './lib/ko-pipeline.mjs'

const DEFAULT_COLLECTION = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/config/AbyssMod/outgame-ja_JP.json'
const DEFAULT_SNAPSHOT = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const outgameFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')
const titlesFile = path.join(ROOT, 'translations', 'titles', 'ko_KR.json')

function parseArgs(argv) {
  const args = {
    collection: DEFAULT_COLLECTION,
    snapshot: DEFAULT_SNAPSHOT,
    noFail: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--collection') args.collection = next()
    else if (arg.startsWith('--collection=')) args.collection = arg.slice('--collection='.length)
    else if (arg === '--snapshot') args.snapshot = next()
    else if (arg.startsWith('--snapshot=')) args.snapshot = arg.slice('--snapshot='.length)
    else if (arg === '--no-fail') args.noFail = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '')
}

function hasJapaneseUiLeftover(value) {
  const text = stripTags(value)
  if (/[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/.test(text)) return true
  return /ストーリー|解放|開放|閲覧|条件|以下|クリア|キャラクター/.test(text)
}

function truncate(value, max = 180) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function storyRewardSource(title) {
  return `ストーリー解放：「${title}」が解放！`
}

const args = parseArgs(process.argv.slice(2))
if (!fs.existsSync(args.collection)) throw new Error(`Missing runtime collection: ${args.collection}`)
if (!fs.existsSync(outgameFile)) throw new Error(`Missing outgame translation: ${outgameFile}`)
if (!fs.existsSync(titlesFile)) throw new Error(`Missing title translation: ${titlesFile}`)

const collection = readJson(args.collection)
const outgame = readJson(outgameFile)
const titles = readJson(titlesFile)
const snapshot = fs.existsSync(args.snapshot) ? readJson(args.snapshot) : { entries: {} }

const sources = new Set([
  'ストーリー解放条件',
  'このストーリーはまだ解放されていません。',
  'このストーリーはまだ開放されていません。',
  '以下の条件をクリアしましょう！',
  'このストーリーはまだ解放されていません。<br>以下の条件をクリアしましょう！',
  'このストーリーはまだ開放されていません。<br>以下の条件をクリアしましょう！',
  'キャラクターストーリーが解放されました。',
  'キャラクターストーリーが開放されました。',
  '閲覧しますか？',
  'キャラクターストーリーが解放されました。<br>閲覧しますか？',
  'キャラクターストーリーが開放されました。<br>閲覧しますか？',
])

for (const source of Object.keys(collection)) {
  if (/^ストーリー解放：「.+」が解放！$/.test(source)) sources.add(source)
}

for (const [location, source] of Object.entries(snapshot.entries || {})) {
  if (/^m_novel_characters\/id:\d+\/3$/.test(location) && typeof source === 'string') {
    sources.add(storyRewardSource(source))
  }
}

const issues = []
for (const source of [...sources].sort()) {
  const rewardTitle = source.match(/^ストーリー解放：「(.+)」が解放！$/)?.[1]
  if (rewardTitle) {
    const titleValue = titles[rewardTitle] || outgame[rewardTitle]
    if (typeof titleValue !== 'string') {
      issues.push({ status: 'missing-title-translation', source: rewardTitle })
    } else if (hasJapaneseUiLeftover(titleValue)) {
      issues.push({ status: 'japanese-title-leftover', source: rewardTitle, value: titleValue })
    }
  }

  const value = outgame[source]
  if (typeof value !== 'string') issues.push({ status: 'missing', source })
  else if (value === source) issues.push({ status: 'untranslated', source, value })
  else if (shouldTranslateValue(source, value) || hasJapaneseUiLeftover(value)) {
    issues.push({ status: 'japanese-leftover', source, value })
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:character-story-ui checked=${sources.size} issues=${issues.length} missing=${counts.missing || 0} untranslated=${counts.untranslated || 0} japanese-leftover=${counts['japanese-leftover'] || 0} missing-title=${counts['missing-title-translation'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  console.log(`\n[${issue.status}] ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
