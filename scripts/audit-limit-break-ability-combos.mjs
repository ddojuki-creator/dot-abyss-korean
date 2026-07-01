#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue } from './lib/ko-pipeline.mjs'

const DEFAULT_REPORT = path.join(ROOT, '.cache', 'game-cache-extract-report.json')
const DEFAULT_SNAPSHOT = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const DEFAULT_TRANSLATIONS = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')

function parseArgs(argv) {
  const args = {
    report: DEFAULT_REPORT,
    snapshot: DEFAULT_SNAPSHOT,
    translations: DEFAULT_TRANSLATIONS,
    all: false,
    noFail: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--report') args.report = next()
    else if (arg.startsWith('--report=')) args.report = arg.slice('--report='.length)
    else if (arg === '--snapshot') args.snapshot = next()
    else if (arg.startsWith('--snapshot=')) args.snapshot = arg.slice('--snapshot='.length)
    else if (arg === '--translations') args.translations = next()
    else if (arg.startsWith('--translations=')) args.translations = arg.slice('--translations='.length)
    else if (arg === '--all') args.all = true
    else if (arg === '--no-fail') args.noFail = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function usage() {
  console.log(`Usage: node scripts/audit-limit-break-ability-combos.mjs [--all] [--no-fail]

Checks limit-break/awakening ability-detail combinations built from
m_ability_details field 4 + field 5.

Default scope is only m_ability_details rows in .cache/game-cache-extract-report.json
changes.added/changed. Use --all for a full historical scan.`)
}

function truncate(value, max = 180) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '')
}

function stripPlaceholderBraces(source) {
  return source.replace(/\{([^{}]+)\}/g, '$1')
}

function colorizePlaceholderBraces(source) {
  return source.replace(/\{([^{}]+)\}/g, '<color=#4CF37B>$1</color>')
}

function placeholderStyleVariants(source) {
  return [...new Set([
    stripPlaceholderBraces(source),
    colorizePlaceholderBraces(source),
  ])]
}

function replaceOutsideColorTags(value, term, replacement) {
  let output = ''
  let cursor = 0
  const colorTagPattern = /<color=[^>]*>.*?<\/color>/gis
  for (const match of value.matchAll(colorTagPattern)) {
    output += value.slice(cursor, match.index).replaceAll(term, replacement)
    output += match[0]
    cursor = match.index + match[0].length
  }
  output += value.slice(cursor).replaceAll(term, replacement)
  return output
}

const STATUS_COLOR_RULES = [
  { source: '紋章：情熱', replacement: '<color=#FF5050>紋章：情熱</color>' },
  { source: '紋章：衝撃', replacement: '<color=#6B8CFF>紋章：衝撃</color>' },
]

function statusColorSourceVariants(source) {
  let variants = [source]
  for (const rule of STATUS_COLOR_RULES) {
    const next = [...variants]
    for (const variant of variants) {
      const replaced = replaceOutsideColorTags(variant, rule.source, rule.replacement)
      if (replaced !== variant) next.push(replaced)
    }
    variants = [...new Set(next)]
  }
  return variants
}

function isAbilityDetailSource(source) {
  const plain = stripTags(source)
  if (/[【](?:発動条件|効果|覚醒効果)[】]/.test(source)) return true
  const terms = [
    /通常攻撃/,
    /通常回復/,
    /攻撃力/,
    /防御力/,
    /最大HP/,
    /ダメージ/,
    /状態異常/,
    /紋章：/,
    /会心/,
    /回復/,
    /バトル開始時/,
    /クエスト中1回まで/,
    /自身/,
    /味方/,
    /敵/,
  ]
  return plain.length >= 16 && terms.some((pattern) => pattern.test(source))
}

function isMeaningfulSource(source) {
  if (typeof source !== 'string') return false
  const text = source.trim()
  if (!text) return false
  if (text === 'データ未設計') return false
  if (text === 'テスト覚醒効果') return false
  return true
}

function locationId(location) {
  const match = location.match(/^m_ability_details\/id:(\d+)\/([45])$/)
  return match ? match[1] : null
}

function changedAbilityDetailIds(report) {
  const ids = new Set()
  const changes = [
    ...(report.changes?.added || []),
    ...(report.changes?.changed || []),
  ]
  for (const change of changes) {
    const id = locationId(change.location || '')
    if (id) ids.add(id)
  }
  return ids
}

function allAbilityDetailIds(entries) {
  const ids = new Set()
  for (const location of Object.keys(entries || {})) {
    const id = locationId(location)
    if (id) ids.add(id)
  }
  return ids
}

function comboVariants(base, awakening) {
  const prefix = '<br><color=#D7DEF8>【覚醒効果】</color>'
  const variants = []
  for (const baseVariant of placeholderStyleVariants(base)) {
    for (const awakeningVariant of placeholderStyleVariants(awakening)) {
      variants.push(`${baseVariant}${prefix}${awakeningVariant}`)
    }
  }
  return variants.flatMap(statusColorSourceVariants)
}

function hasJapaneseLeftover(value) {
  const text = stripTags(value)
  if (/[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/.test(text)) return true
  return /発動条件|覚醒効果|自身|味方|敵|通常|攻撃|防御|最大|上昇|減少|付与|状態異常|紋章|会心|回復|秒|確率|バトル|クエスト/.test(text)
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  usage()
  process.exit(0)
}

if (!fs.existsSync(args.snapshot)) throw new Error(`Missing snapshot: ${args.snapshot}`)
if (!fs.existsSync(args.translations)) throw new Error(`Missing translations: ${args.translations}`)
if (!args.all && !fs.existsSync(args.report)) throw new Error(`Missing report: ${args.report}`)

const snapshot = readJson(args.snapshot)
const entries = snapshot.entries || {}
const translations = readJson(args.translations)
const report = args.all ? null : readJson(args.report)
const ids = args.all ? allAbilityDetailIds(entries) : changedAbilityDetailIds(report)

const sources = []
for (const id of ids) {
  const base = entries[`m_ability_details/id:${id}/4`]
  const awakening = entries[`m_ability_details/id:${id}/5`]
  if (!isMeaningfulSource(base) || !isMeaningfulSource(awakening)) continue
  if (!isAbilityDetailSource(base) && !isAbilityDetailSource(awakening)) continue
  for (const source of comboVariants(base, awakening)) {
    sources.push({ id, source })
  }
}

const uniqueSources = []
const seen = new Set()
for (const item of sources) {
  if (seen.has(item.source)) continue
  seen.add(item.source)
  uniqueSources.push(item)
}

const issues = []
for (const item of uniqueSources) {
  const value = translations[item.source]
  if (typeof value !== 'string') {
    issues.push({ status: 'missing-limit-break-combo', ...item })
  } else if (value === item.source) {
    issues.push({ status: 'untranslated-limit-break-combo', ...item, value })
  } else if (shouldTranslateValue(item.source, value) || hasJapaneseLeftover(value)) {
    issues.push({ status: 'japanese-leftover-limit-break-combo', ...item, value })
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:limit-break-ability-combos scope=${args.all ? 'all' : 'changed'} ids=${ids.size} checked=${uniqueSources.length} issues=${issues.length} missing=${counts['missing-limit-break-combo'] || 0} untranslated=${counts['untranslated-limit-break-combo'] || 0} japanese-leftover=${counts['japanese-leftover-limit-break-combo'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  console.log(`\n[${issue.status}] id=${issue.id} ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
