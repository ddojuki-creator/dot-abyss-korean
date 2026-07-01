#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue } from './lib/ko-pipeline.mjs'

const DEFAULT_SNAPSHOT = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const DEFAULT_TRANSLATIONS = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')

function parseArgs(argv) {
  const args = {
    snapshot: DEFAULT_SNAPSHOT,
    translations: DEFAULT_TRANSLATIONS,
    noFail: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--snapshot') args.snapshot = next()
    else if (arg.startsWith('--snapshot=')) args.snapshot = arg.slice('--snapshot='.length)
    else if (arg === '--translations') args.translations = next()
    else if (arg.startsWith('--translations=')) args.translations = arg.slice('--translations='.length)
    else if (arg === '--no-fail') args.noFail = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function usage() {
  console.log(`Usage: node scripts/audit-character-ability-upgrade-matrix.mjs [--no-fail]

Checks m_ability_details as upgrade matrices. Ability detail ids are grouped by
Math.floor(id / 100), with levels 01-10 as base, 11-20 as first upgrade, and
21-30 as second upgrade. The audit verifies meaningful base/upgrade source keys
and translated values are present in translations/outgame/ko_KR.json.`)
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '')
}

function truncate(value, max = 180) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function isMeaningfulSource(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false
  if (text === 'データ未設計') return false
  if (text === 'テスト覚醒効果') return false
  return true
}

function hasJapaneseLeftover(value) {
  const text = stripTags(value)
  if (/[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/.test(text)) return true
  return /発動条件|覚醒効果|自身|味方|敵|通常|攻撃|防御|最大|上昇|減少|付与|状態異常|紋章|会心|回復|秒|確率|対象|バトル|クエスト|スキルチャージ|被ダメージ|ノワール|憑依/.test(text)
}

function parseAbilityLocation(location) {
  const match = location.match(/^m_ability_details\/id:(\d+)\/([45])$/)
  if (!match) return null
  const id = Number(match[1])
  const slot = id % 100
  if (slot < 1 || slot > 30) return null
  return {
    id,
    field: match[2],
    group: Math.floor(id / 100),
    tier: Math.ceil(slot / 10),
    level: ((slot - 1) % 10) + 1,
  }
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  usage()
  process.exit(0)
}

if (!fs.existsSync(args.snapshot)) throw new Error(`Missing snapshot: ${args.snapshot}`)
if (!fs.existsSync(args.translations)) throw new Error(`Missing translations: ${args.translations}`)

const snapshot = readJson(args.snapshot)
const translations = readJson(args.translations)
const entries = snapshot.entries || {}
const groups = new Map()
const issues = []
const warnings = []

for (const [location, source] of Object.entries(entries)) {
  const parsed = parseAbilityLocation(location)
  if (!parsed || !isMeaningfulSource(source)) continue

  if (!groups.has(parsed.group)) groups.set(parsed.group, new Map())
  const tiers = groups.get(parsed.group)
  if (!tiers.has(parsed.tier)) tiers.set(parsed.tier, new Map())
  const levels = tiers.get(parsed.tier)
  if (!levels.has(parsed.level)) levels.set(parsed.level, { id: parsed.id, fields: new Map() })
  levels.get(parsed.level).fields.set(parsed.field, source)

  const value = translations[source]
  if (typeof value !== 'string') {
    issues.push({ status: 'missing-source-key', id: parsed.id, field: parsed.field, source })
  } else if (value === source) {
    issues.push({ status: 'untranslated-source-key', id: parsed.id, field: parsed.field, source, value })
  } else if (shouldTranslateValue(source, value) || hasJapaneseLeftover(value)) {
    issues.push({ status: 'japanese-leftover-source-key', id: parsed.id, field: parsed.field, source, value })
  }
}

let upgradeGroups = 0
let fullThreeTierGroups = 0
let checkedRows = 0
for (const [group, tiers] of groups) {
  const tierNums = [...tiers.keys()].sort((a, b) => a - b)
  const hasUpgrade = tierNums.some((tier) => tier > 1)
  if (!hasUpgrade) continue
  upgradeGroups += 1
  if ([1, 2, 3].every((tier) => tiers.has(tier))) fullThreeTierGroups += 1

  for (const tier of [1, 2, 3]) {
    if (!tiers.has(tier)) {
      warnings.push({ status: 'partial-upgrade-tier', group, tier, source: `group ${group} tier ${tier}` })
      continue
    }
    for (const [level, item] of tiers.get(tier)) {
      if (item.fields.has('4')) checkedRows += 1
      if (!item.fields.has('4')) {
        issues.push({ status: 'missing-ability-body', id: item.id, field: '4', source: `m_ability_details/id:${item.id}/4` })
      }
    }
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:character-ability-upgrade-matrix groups=${groups.size} upgradeGroups=${upgradeGroups} fullThreeTierGroups=${fullThreeTierGroups} checkedRows=${checkedRows} issues=${issues.length} warnings=${warnings.length} missingKey=${counts['missing-source-key'] || 0} untranslated=${counts['untranslated-source-key'] || 0} japaneseLeftover=${counts['japanese-leftover-source-key'] || 0} missingBody=${counts['missing-ability-body'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  const id = issue.id ? ` id=${issue.id}` : ''
  const field = issue.field ? ` field=${issue.field}` : ''
  console.log(`\n[${issue.status}]${id}${field} ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

for (const warning of warnings.slice(0, 20)) {
  console.log(`\n[warning:${warning.status}] ${truncate(JSON.stringify(warning.source))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
