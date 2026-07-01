#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue, writeJson } from './lib/ko-pipeline.mjs'

const DEFAULT_COLLECTION = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/config/AbyssMod/outgame-ja_JP.json'
const DEFAULT_SNAPSHOT = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const outgameFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')
const titlesFile = path.join(ROOT, 'translations', 'titles', 'ko_KR.json')
const descriptionsFile = path.join(ROOT, 'translations', 'descriptions', 'ko_KR.json')

function parseArgs(argv) {
  const args = {
    collection: DEFAULT_COLLECTION,
    snapshot: DEFAULT_SNAPSHOT,
    noFail: false,
    writeMissingSource: false,
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
    else if (arg === '--write-missing-source') args.writeMissingSource = true
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

function isRuntimeStoryUiSource(source) {
  return /ストーリー|閲覧しますか|再生しますか|재생하시겠습니까|初回報酬|クリアで解放|鬼退治|鬼と協力|追加データ.*ボイス/s.test(source)
}

function isStoryMetadataLocation(location) {
  return [
    /^m_novel_characters\/id:\d+\/(?:3|4)$/,
    /^m_novel_character_skins\/id:\d+\/(?:4|5)$/,
    /^m_novel_mains\/id:\d+\/(?:4|5)$/,
    /^m_novel_others\/id:\d+\/(?:2|4|5)$/,
    /^m_novel_prologues\/id:\d+\/(?:3|4)$/,
    /^m_event_story_stages\/id:\d+\/2$/,
  ].some((pattern) => pattern.test(location))
}

function isStoryDescriptionLocation(location) {
  return [
    /^m_novel_characters\/id:\d+\/4$/,
    /^m_novel_character_skins\/id:\d+\/5$/,
    /^m_novel_mains\/id:\d+\/5$/,
    /^m_novel_others\/id:\d+\/5$/,
    /^m_novel_prologues\/id:\d+\/4$/,
  ].some((pattern) => pattern.test(location))
}

const args = parseArgs(process.argv.slice(2))
if (!fs.existsSync(args.collection)) throw new Error(`Missing runtime collection: ${args.collection}`)
if (!fs.existsSync(outgameFile)) throw new Error(`Missing outgame translation: ${outgameFile}`)
if (!fs.existsSync(titlesFile)) throw new Error(`Missing title translation: ${titlesFile}`)
if (!fs.existsSync(descriptionsFile)) throw new Error(`Missing description translation: ${descriptionsFile}`)

const collection = readJson(args.collection)
const outgame = readJson(outgameFile)
const titles = readJson(titlesFile)
const descriptions = readJson(descriptionsFile)
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
const descriptionSources = new Set()

for (const source of Object.keys(collection)) {
  if (isRuntimeStoryUiSource(source)) sources.add(source)
}

for (const [location, source] of Object.entries(snapshot.entries || {})) {
  if (typeof source !== 'string') continue
  if (isStoryMetadataLocation(location)) {
    sources.add(source)
  }
  if (isStoryDescriptionLocation(location)) {
    descriptionSources.add(source)
  }
  if (/^m_novel_characters\/id:\d+\/3$/.test(location)) {
    sources.add(storyRewardSource(source))
  }
}

if (args.writeMissingSource) {
  const seeded = []
  for (const source of [...sources].sort()) {
    if (typeof outgame[source] === 'string') continue
    outgame[source] = source
    seeded.push(source)
  }
  if (seeded.length) {
    writeJson(outgameFile, outgame)
    console.log(`audit:character-story-ui seeded-missing=${seeded.length}`)
  }

  const seededDescriptions = []
  for (const source of [...descriptionSources].sort()) {
    if (typeof descriptions[source] === 'string') continue
    descriptions[source] = typeof outgame[source] === 'string' && outgame[source] !== source
      ? outgame[source]
      : source
    seededDescriptions.push(source)
  }
  if (seededDescriptions.length) {
    writeJson(descriptionsFile, descriptions)
    console.log(`audit:character-story-ui seeded-missing-descriptions=${seededDescriptions.length}`)
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

for (const source of [...descriptionSources].sort()) {
  const value = descriptions[source]
  if (typeof value !== 'string') issues.push({ status: 'missing-description', source })
  else if (value === source) issues.push({ status: 'untranslated-description', source, value })
  else if (shouldTranslateValue(source, value) || hasJapaneseUiLeftover(value)) {
    issues.push({ status: 'japanese-leftover-description', source, value })
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:character-story-ui checked=${sources.size} descriptions=${descriptionSources.size} issues=${issues.length} missing=${counts.missing || 0} untranslated=${counts.untranslated || 0} japanese-leftover=${counts['japanese-leftover'] || 0} missing-title=${counts['missing-title-translation'] || 0} missing-description=${counts['missing-description'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  console.log(`\n[${issue.status}] ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
