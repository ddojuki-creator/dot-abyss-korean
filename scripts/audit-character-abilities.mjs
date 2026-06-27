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
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function usage() {
  console.log(`Usage: node scripts/audit-character-abilities.mjs [--collection path] [--no-fail]

Checks runtime-collected outgame Japanese strings for character ability descriptions that
are missing or still contain Japanese in translations/outgame/ko_KR.json.`)
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '')
}

function isCharacterAbilitySource(source) {
  const plain = stripTags(source)
  if (/[【](?:発動条件|効果|覚醒効果)[】]/.test(source)) return true
  if (/<color=#D7DEF8>【覚醒効果】<\/color>/.test(source)) return true

  const terms = [
    /ノワール憑依/,
    /会心時/,
    /通常攻撃/,
    /通常回復/,
    /紋章：/,
    /喪失状態/,
    /炎上状態/,
    /戦闘不能/,
    /状態異常/,
    /スキルチャージ/,
    /被ダメージ/,
    /味方全体/,
    /自身の/,
    /自身が/,
    /バトル開始時/,
    /クエスト中1回まで/,
  ]
  const hitCount = terms.filter((pattern) => pattern.test(source)).length
  return plain.length >= 28 && hitCount >= 2 && /【[^】]+】/.test(source)
}

function truncate(value, max = 180) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function hasJapaneseAbilityLeftover(value) {
  const text = stripTags(value)
  if (/[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/.test(text)) return true
  return /発動条件|覚醒効果|自身|味方|敵|通常|攻撃|防御|最大|上昇|減少|付与|状態異常|紋章|会心|回復|秒|確率|対象|喪失|炎上|戦闘不能|バトル|クエスト|スキルチャージ|被ダメージ|ノワール|憑依/.test(text)
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  usage()
  process.exit(0)
}

if (!fs.existsSync(args.collection)) throw new Error(`Missing runtime collection: ${args.collection}`)
if (!fs.existsSync(translationFile)) throw new Error(`Missing outgame translation: ${translationFile}`)

const collection = readJson(args.collection)
const translations = readJson(translationFile)
const sources = Object.keys(collection).filter(isCharacterAbilitySource).sort()
const issues = []

for (const source of sources) {
  const value = translations[source]
  if (typeof value !== 'string') {
    issues.push({ status: 'missing', source })
  } else if (value === source) {
    issues.push({ status: 'untranslated', source, value })
  } else if (shouldTranslateValue(source, value) || hasJapaneseAbilityLeftover(value)) {
    issues.push({ status: 'japanese-leftover', source, value })
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:character-abilities checked=${sources.length} issues=${issues.length} missing=${counts.missing || 0} untranslated=${counts.untranslated || 0} japanese-leftover=${counts['japanese-leftover'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  console.log(`\n[${issue.status}] ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
