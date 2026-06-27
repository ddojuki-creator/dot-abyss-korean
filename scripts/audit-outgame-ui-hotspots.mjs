#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue } from './lib/ko-pipeline.mjs'

const DEFAULT_COLLECTION = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/config/AbyssMod/outgame-ja_JP.json'
const translationFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')

function parseArgs(argv) {
  const args = {
    collection: DEFAULT_COLLECTION,
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
    else if (arg === '--no-fail') args.noFail = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

const HOTSPOTS = [
  /研究効果/,
  /イベント\s*ステージ|チャレンジ\s*ステージ|イベントミッション/,
  /クリスタルハント\d/,
  /アイテムの使用|アイテムを使用|アイテムを使って|アイテムを消費/,
  /アビリティ 強化|スキル \/ アビリティ 詳細情報/,
  /覚醒pt|覚醒強化|絆pt|限界突破/,
  /^マント$/,
  /ランク\d+の(?:コモン|エピック|レジェンダー).+マント/,
]

function isHotspot(source) {
  if (/^探索隊[A-Z]が/.test(source)) return false
  return HOTSPOTS.some((pattern) => pattern.test(source))
}

function hasJapaneseLeftover(value) {
  const text = value.replace(/<[^>]*>/g, '')
  if (/[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/.test(text)) return true
  return /研究効果|解放|開放|使用|所持|消費|覚醒|絆|限界突破|イベント|ステージ|ミッション|クリスタル|マント|ランク/.test(text)
}

function truncate(value, max = 180) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

const args = parseArgs(process.argv.slice(2))
if (!fs.existsSync(args.collection)) throw new Error(`Missing runtime collection: ${args.collection}`)
if (!fs.existsSync(translationFile)) throw new Error(`Missing outgame translation: ${translationFile}`)

const collection = readJson(args.collection)
const translations = readJson(translationFile)
const sources = Object.keys(collection).filter(isHotspot).sort()
const issues = []

for (const source of sources) {
  const value = translations[source]
  if (typeof value !== 'string') issues.push({ status: 'missing', source })
  else if (value === source) issues.push({ status: 'untranslated', source, value })
  else if (shouldTranslateValue(source, value) || hasJapaneseLeftover(value)) {
    issues.push({ status: 'japanese-leftover', source, value })
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:outgame-ui-hotspots checked=${sources.length} issues=${issues.length} missing=${counts.missing || 0} untranslated=${counts.untranslated || 0} japanese-leftover=${counts['japanese-leftover'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  console.log(`\n[${issue.status}] ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
