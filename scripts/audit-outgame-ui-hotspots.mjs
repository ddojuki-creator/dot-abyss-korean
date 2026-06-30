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
  /エネミー|ドロップアイテム/,
  /防衛設備|マナ燃料|迎撃型|支援型|罠型|障害物型|壁上型|基地スキル/,
  /アイテムの使用|アイテムを使用|アイテムを使って|アイテムを消費/,
  /ストーリー解放|キャラクターストーリー|閲覧しますか|このストーリーはまだ|以下の条件をクリア/,
  /アビリティ 強化|スキル \/ アビリティ 詳細情報/,
  /覚醒pt|覚醒強化|絆pt|限界突破/,
  /フォロー|フォロワー|おすすめ|ID検索|プレイヤーLv|最終ログイン/,
  /時間前|日前|分前|秒前/,
  /配置終了|受取|購入|提供割合|ショップへ|ウィークリー|VIP特典/,
  /探索クエスト|探索隊|探索での追加|クエストでの追加|発見：|期限/,
  /厄災|討伐依頼|アップグレードが完了|以下のボーナス/,
  /出現ランク|出現レアリティ|ユニーク/,
  /^土$/,
  /^マント$/,
  /ランク\d+の(?:コモン|エピック|レジェンダー).+マント/,
]

function isHotspot(source) {
  if (/^探索隊[A-Z]が/.test(source)) return false
  if (/^(探索隊[A-Z]|探索隊[A-Z]가|탐색대 [A-Z]가|탐색대[A-Z]가).*(発見|발견)/.test(source)) return false
  if (/\n/.test(source) && /(探索隊[A-Z]|探索隊[A-Z]가|탐색대 [A-Z]가|探索隊[A-Z]が|をクリア！|が発生！|클리어했다|발생했다)/.test(source)) {
    return false
  }
  return HOTSPOTS.some((pattern) => pattern.test(source))
}

function hasJapaneseLeftover(value) {
  const text = value.replace(/<[^>]*>/g, '')
  if (/[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/.test(text)) return true
  return /研究効果|解放|開放|使用|所持|消費|覚醒|絆|限界突破|イベント|ステージ|ミッション|クリスタル|マント|ランク|エネミー|ドロップアイテム|防衛設備|マナ燃料|迎撃型|支援型|罠型|障害物型|壁上型|基地スキル|フォロー|フォロワー|おすすめ|ID検索|プレイヤーLv|最終ログイン|配置終了|受取|購入|提供割合|ショップ|ウィークリー|VIP特典|探索クエスト|探索隊|厄災|討伐依頼|アップグレード|出現ランク|出現レアリティ|ユニーク/.test(text)
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
