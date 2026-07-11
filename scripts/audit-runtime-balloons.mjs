#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, writeJson } from './lib/ko-pipeline.mjs'

const DEFAULT_COLLECTION = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/config/AbyssMod/outgame-ja_JP.json'
const DEFAULT_LOG = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/LogOutput.log'
const DEFAULT_REPORT = path.join(ROOT, '.cache', 'runtime-balloon-audit.json')
const japanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/
const korean = /[\uac00-\ud7af]/
const richText = /<[^>]*>/g
const dynamicToken = /\{\[[^\]]+\][^}]*\}/g

function parseArgs(argv) {
  const args = {
    collection: DEFAULT_COLLECTION,
    translation: path.join(ROOT, 'translations', 'outgame', 'ko_KR.json'),
    log: DEFAULT_LOG,
    report: DEFAULT_REPORT,
    fail: false,
    failOnMixed: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--collection') args.collection = next()
    else if (arg.startsWith('--collection=')) args.collection = arg.slice('--collection='.length)
    else if (arg === '--translation') args.translation = next()
    else if (arg.startsWith('--translation=')) args.translation = arg.slice('--translation='.length)
    else if (arg === '--log') args.log = next()
    else if (arg.startsWith('--log=')) args.log = arg.slice('--log='.length)
    else if (arg === '--report') args.report = next()
    else if (arg.startsWith('--report=')) args.report = arg.slice('--report='.length)
    else if (arg === '--fail') args.fail = true
    else if (arg === '--fail-on-mixed') args.failOnMixed = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function stripRichText(value) {
  return String(value || '').replace(richText, '')
}

function hasJapanese(value) {
  return japanese.test(stripRichText(value))
}

function hasKorean(value) {
  return korean.test(stripRichText(value))
}

function isBalloonCandidate(source) {
  const plain = stripRichText(source).trim()
  if (plain.length < 8 || plain.length > 500 || !hasJapanese(plain)) return false
  if (/^[\d\s.,:/+%#ｰー・【】「」()（）［］]+$/.test(plain)) return false
  if (/^(?:あと)?\d+日\d+時間|^\d+日\d+時間/.test(plain)) return false
  if (/DMMポイント|交換可能|注意事項|^▼/.test(plain)) return false
  if (/\r?\n/.test(source) && /유료|무료|SSR|아이템 목록|교환 가능|주의사항/.test(plain)) return false
  if (/^ランク\d+の(?:コモン|エピック|レジェンダー)\s/.test(plain)) return false
  if (/探索隊|탐색대/.test(plain) && /発見|발견|재료/.test(plain)) return false
  if (/제\d+계층|解放|발동 조건|발동조건|효과】|스킬 충전/.test(plain)) return false
  if (/\r?\n/.test(source) && /探索隊|第\d+階層|発見|発生|クリア/.test(plain)) return false
  return /[。！？!?…]|<br>|\r?\n/.test(source) || /[ぁ-んァ-ン一-龯].*[ぁ-んァ-ン一-龯]/.test(plain)
}

function truncate(value, max = 180) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function collectRuntimeBalloonPaths(logFile) {
  if (!fs.existsSync(logFile)) return { paths: [], novelIds: [] }
  const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/)
  const paths = lines
    .filter((line) => /TextBalloon|InfoNovel|Balloon/i.test(line))
    .map((line) => line.trim())
    .filter(Boolean)
  const novelIds = [...new Set(
    lines
      .flatMap((line) => line.match(/(?:mas_\d{10}|(?:evs|hmr|hmn|men)_\d{11})/g) || []),
  )].sort()
  return { paths, novelIds }
}

function matchesDynamicTemplate(source, template) {
  const tokens = [...template.matchAll(dynamicToken)]
  if (!tokens.length) return false
  let pattern = '^'
  let offset = 0
  for (const token of tokens) {
    pattern += escapeRegex(template.slice(offset, token.index))
    pattern += '.+?'
    offset = token.index + token[0].length
  }
  pattern += escapeRegex(template.slice(offset))
  return new RegExp(`${pattern}$`, 's').test(source)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log('Usage: node scripts/audit-runtime-balloons.mjs [--fail] [--fail-on-mixed] [--collection path] [--translation path] [--log path]')
  process.exit(0)
}
if (!fs.existsSync(args.collection)) throw new Error(`Missing runtime collection: ${args.collection}`)
if (!fs.existsSync(args.translation)) throw new Error(`Missing outgame translation: ${args.translation}`)

const collection = readJson(args.collection)
const translations = readJson(args.translation)
const dynamicTemplates = Object.keys(translations).filter((source) => dynamicToken.test(source))
const candidates = Object.keys(collection)
  .filter(isBalloonCandidate)
  .sort()
const entries = candidates.map((source) => {
  const value = translations[source]
  let status = 'ok'
  if (typeof value !== 'string') {
    status = dynamicTemplates.some((template) => matchesDynamicTemplate(source, template))
      ? 'covered-by-dynamic-template'
      : 'missing'
  }
  else if (value === source) status = 'untranslated'
  else if (hasJapanese(value)) status = 'japanese-leftover'
  return { source, value: value ?? null, status, mixedSource: hasKorean(source) }
})
const issues = entries.filter((entry) => entry.status === 'missing' || entry.status === 'untranslated' || entry.status === 'japanese-leftover')
const coveredByTemplate = entries.filter((entry) => entry.status === 'covered-by-dynamic-template')
const mixedIssues = issues.filter((entry) => entry.mixedSource)
const runtime = collectRuntimeBalloonPaths(args.log)
const report = {
  collection: args.collection,
  translation: args.translation,
  candidates: entries,
  issues,
  mixedIssues,
  runtimeBalloonPaths: runtime.paths,
  runtimeNovelIds: runtime.novelIds,
}
writeJson(args.report, report)

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})
console.log(`audit:runtime-balloons candidates=${candidates.length} issues=${issues.length} mixedIssues=${mixedIssues.length} dynamicCovered=${coveredByTemplate.length} runtimeBalloonPaths=${runtime.paths.length} runtimeNovelIds=${runtime.novelIds.length}`)
console.log(`- missing=${counts.missing || 0} untranslated=${counts.untranslated || 0} japaneseLeftover=${counts['japanese-leftover'] || 0}`)
for (const entry of issues.slice(0, 50)) {
  console.log(`\n[${entry.status}${entry.mixedSource ? ':mixed-source' : ''}] ${truncate(entry.source)}`)
  if (entry.value != null) console.log(`value: ${truncate(entry.value)}`)
}
for (const line of runtime.paths.slice(-10)) console.log(`\n[runtime-path] ${truncate(line, 240)}`)

if ((args.fail && issues.length) || (args.failOnMixed && mixedIssues.length)) process.exitCode = 1
