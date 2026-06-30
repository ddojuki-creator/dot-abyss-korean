#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue } from './lib/ko-pipeline.mjs'

const DEFAULT_COLLECTION = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/config/AbyssMod/outgame-ja_JP.json'
const DEFAULT_SNAPSHOT = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const translationFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')
const abilityTranslationFile = path.join(ROOT, 'translations', 'ability_descriptions', 'ko_KR.json')
const CHARACTER_SNAPSHOT_FIELDS_BY_TABLE = new Map([
  ['m_character_abilities', new Set(['3', '4'])],
  ['m_character_action_skills', new Set(['3', '4'])],
  ['m_ability_details', new Set(['4', '5'])],
])

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
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function usage() {
  console.log(`Usage: node scripts/audit-character-abilities.mjs [--collection path] [--snapshot path] [--no-fail]

Checks runtime-collected outgame Japanese strings for character ability descriptions that
are missing or still contain Japanese in translations/outgame/ko_KR.json.
Also fails when ability_descriptions entries are not mirrored into outgame, because
the current CDN manifest does not publish ability_descriptions separately.
Also checks character skill/ability/detail rows in snapshots/game-cache-ja_JP.json
so new characters and limit-break/awakening text are caught before their strings
appear in the runtime collection.`)
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
    /パラメーター/,
    /大砲/,
    /召喚/,
    /引き継ぐ/,
    /喪失状態/,
    /炎上状態/,
    /戦闘不能/,
    /状態異常/,
    /スキルチャージ/,
    /ダメージ/,
    /HIT/,
    /連撃率/,
    /連撃確率/,
    /被ダメージ/,
    /味方全体/,
    /自身の/,
    /自身が/,
    /自身に/,
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

function locationTable(location) {
  return location.split('/', 1)[0]
}

function locationField(location) {
  return location.split('/').pop()
}

function isCharacterSnapshotLocation(location) {
  const fields = CHARACTER_SNAPSHOT_FIELDS_BY_TABLE.get(locationTable(location))
  return fields ? fields.has(locationField(location)) : false
}

function hasBareRuntimeToken(source) {
  return /(^|[^{])\[[A-Z0-9_.]+\]/.test(source)
}

function dynamicSkeleton(source) {
  return stripTags(source)
    .replace(/\{\[[^\]]+\]([^}]*)\}/g, '{#}$1')
    .replace(/(^|[^{])\[[A-Z0-9_.]+\]/g, '$1{#}')
    .replace(/\{(?!#\})(?!\[)[^{}]+\}/g, '{#}')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectSafeDynamicSkeletons(translations) {
  const skeletons = new Map()
  for (const source of Object.keys(translations)) {
    if (hasBareRuntimeToken(source)) continue
    const skeleton = dynamicSkeleton(source)
    if (!skeletons.has(skeleton)) skeletons.set(skeleton, [])
    skeletons.get(skeleton).push(source)
  }
  return skeletons
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
const abilityTranslations = fs.existsSync(abilityTranslationFile) ? readJson(abilityTranslationFile) : {}
const snapshot = fs.existsSync(args.snapshot) ? readJson(args.snapshot) : { entries: {} }
const snapshotSources = Object.entries(snapshot.entries || {})
  .filter(([location, source]) => isCharacterSnapshotLocation(location) && typeof source === 'string')
  .map(([, source]) => source)

function stripPlaceholderBraces(source) {
  return source.replace(/\{([^{}]+)\}/g, '$1')
}

function sourceLooksLikePicoShockAbility(source) {
  return typeof source === 'string'
    && source.includes('敵が戦闘不能になったとき、【25%】')
    && source.includes('紋章：衝撃')
    && source.includes('自身のスキルを')
}

function collectRuntimeAbilityVariants(entries) {
  const variants = []
  for (const [location, source] of Object.entries(entries || {})) {
    if (!/^m_ability_details\/id:\d+\/4$/.test(location) || !sourceLooksLikePicoShockAbility(source)) continue
    const concreteSource = stripPlaceholderBraces(source)
    variants.push(concreteSource)

    const awakeningSource = entries[location.replace(/\/4$/, '/5')]
    if (typeof awakeningSource === 'string') {
      variants.push(`${concreteSource}<br><color=#D7DEF8>【覚醒効果】</color>${stripPlaceholderBraces(awakeningSource)}`)
    }
  }
  return variants
}

const sources = [
  ...new Set([
    ...Object.keys(collection).filter(isCharacterAbilitySource),
    ...snapshotSources,
    ...collectRuntimeAbilityVariants(snapshot.entries || {}),
    ...Object.keys(translations).filter(isCharacterAbilitySource),
    ...Object.keys(abilityTranslations).filter(isCharacterAbilitySource),
  ]),
].sort()
const issues = []
const safeDynamicSkeletons = collectSafeDynamicSkeletons(translations)

for (const source of sources) {
  const value = translations[source]
  if (typeof value !== 'string') {
    issues.push({ status: 'missing', source })
  } else if (value === source) {
    issues.push({ status: 'untranslated', source, value })
  } else if (shouldTranslateValue(source, value) || hasJapaneseAbilityLeftover(value)) {
    issues.push({ status: 'japanese-leftover', source, value })
  } else if (
    hasBareRuntimeToken(source) &&
    !(safeDynamicSkeletons.get(dynamicSkeleton(source)) || []).some((candidate) => candidate !== source)
  ) {
    issues.push({ status: 'unsafe-dynamic-template', source, value })
  }
}

for (const source of Object.keys(abilityTranslations).sort()) {
  if (typeof translations[source] !== 'string') {
    issues.push({ status: 'ability-only-not-in-outgame', source, value: abilityTranslations[source] })
  }
}

const counts = issues.reduce((acc, issue) => {
  acc[issue.status] = (acc[issue.status] || 0) + 1
  return acc
}, {})

console.log(
  `audit:character-abilities checked=${sources.length} issues=${issues.length} missing=${counts.missing || 0} untranslated=${counts.untranslated || 0} japanese-leftover=${counts['japanese-leftover'] || 0} unsafe-dynamic=${counts['unsafe-dynamic-template'] || 0} ability-only=${counts['ability-only-not-in-outgame'] || 0}`,
)

for (const issue of issues.slice(0, 50)) {
  console.log(`\n[${issue.status}] ${truncate(JSON.stringify(issue.source))}`)
  if (issue.value != null) console.log(`value: ${truncate(JSON.stringify(issue.value))}`)
}

if (issues.length && !args.noFail) {
  process.exitCode = 1
}
