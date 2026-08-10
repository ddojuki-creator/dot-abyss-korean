#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, writeJson } from './lib/ko-pipeline.mjs'

const DEFAULT_SNAPSHOT = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const DEFAULT_TRANSLATIONS = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')

function parseArgs(argv) {
  const args = {
    snapshot: DEFAULT_SNAPSHOT,
    translations: DEFAULT_TRANSLATIONS,
    dryRun: false,
    force: false,
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
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--force') args.force = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

function usage() {
  console.log(`Usage: node scripts/sync-limit-break-ability-combos.mjs [--dry-run] [--force]

Builds standalone and combined exact outgame keys for limit-break/awakening
ability rows from m_ability_details field 4 + field 5. The game UI can render
the fields separately or as one combined string, so both forms must exist to
prevent partial Japanese fallback.`)
}

function stripPlaceholderBraces(source) {
  return source.replace(/\{([^{}]+)\}/g, '$1')
}

const VALUE_COLOR_CODES = ['4CF37B', 'F4FF00']

function colorizePlaceholderBraces(source, colorCode) {
  return source.replace(/\{([^{}]+)\}/g, `<color=#${colorCode}>$1</color>`)
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
  {
    source: '紋章：情熱',
    sourceReplacement: '<color=#FF5050>紋章：情熱</color>',
    targetTerms: ['문장: 열정', '문장：열정', '문장: 정열', '문장：정열'],
    targetReplacement: '<color=#FF5050>문장: 열정</color>',
  },
  {
    source: '紋章：衝撃',
    sourceReplacement: '<color=#6B8CFF>紋章：衝撃</color>',
    targetTerms: ['문장: 충격', '문장：충격'],
    targetReplacement: '<color=#6B8CFF>문장: 충격</color>',
  },
]

function statusColorComboVariants(item) {
  let variants = [item]
  for (const rule of STATUS_COLOR_RULES) {
    const next = [...variants]
    for (const variant of variants) {
      const source = replaceOutsideColorTags(variant.source, rule.source, rule.sourceReplacement)
      if (source === variant.source) continue

      let target = variant.target
      for (const term of rule.targetTerms) {
        target = replaceOutsideColorTags(target, term, rule.targetReplacement)
      }
      if (target === variant.target) continue
      next.push({ ...variant, source, target })
    }
    variants = [...new Map(next.map((variant) => [variant.source, variant])).values()]
  }
  return variants
}

function placeholderStylePairs(source, target) {
  const pairs = [
    {
      source: stripPlaceholderBraces(source),
      target: stripPlaceholderBraces(target),
    },
  ]
  for (const colorCode of VALUE_COLOR_CODES) {
    pairs.push({
      source: colorizePlaceholderBraces(source, colorCode),
      target: colorizePlaceholderBraces(target, colorCode),
    })
  }
  return pairs.filter((item, index, items) => items.findIndex((other) => other.source === item.source) === index)
}

function isMeaningfulSource(source) {
  if (typeof source !== 'string') return false
  const text = source.trim()
  if (!text) return false
  if (text === 'データ未設計') return false
  if (text === 'テスト覚醒効果') return false
  return true
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '')
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

function comboItems(id, baseSource, awakeningSource, baseTranslation, awakeningTranslation) {
  const sourcePrefix = '<br><color=#D7DEF8>【覚醒効果】</color>'
  const targetPrefix = '<br><color=#D7DEF8>【각성 효과】</color>'
  const basePairs = placeholderStylePairs(baseSource, baseTranslation)
  const awakeningPairs = placeholderStylePairs(awakeningSource, awakeningTranslation)

  const items = []
  for (const base of basePairs) {
    for (const awakening of awakeningPairs) {
      items.push({
        id,
        source: `${base.source}${sourcePrefix}${awakening.source}`,
        target: `${base.target}${targetPrefix}${awakening.target}`,
      })
    }
  }
  return items.flatMap(statusColorComboVariants)
}

function standaloneItems(id, kind, source, translation) {
  return placeholderStylePairs(source, translation)
    .map((item) => ({ id, kind, ...item }))
    .flatMap(statusColorComboVariants)
}

function bondRewardItems(id, source, translation) {
  return [
    {
      id,
      source: `「${source}」の解放条件達成！`,
      target: `「${translation}」의 해방 조건 달성!`,
    },
    {
      id,
      source: `「${source}」の最大Lvが10に上昇！`,
      target: `「${translation}」의 최대 Lv가 10으로 상승!`,
    },
  ]
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  usage()
  process.exit(0)
}

if (!fs.existsSync(args.snapshot)) throw new Error(`Missing snapshot: ${args.snapshot}`)
if (!fs.existsSync(args.translations)) throw new Error(`Missing translations: ${args.translations}`)

const snapshot = readJson(args.snapshot)
const entries = snapshot.entries || {}
const translations = readJson(args.translations)
const additions = []
const updates = []
const skipped = []

for (const [location, baseSource] of Object.entries(entries)) {
  const match = location.match(/^m_ability_details\/id:(\d+)\/4$/)
  if (!match || !isMeaningfulSource(baseSource)) continue

  const id = match[1]
  const awakeningSource = entries[`m_ability_details/id:${id}/5`]
  if (!isMeaningfulSource(awakeningSource)) continue
  if (!isAbilityDetailSource(baseSource) && !isAbilityDetailSource(awakeningSource)) continue

  const baseTranslation = translations[baseSource]
  const awakeningTranslation = translations[awakeningSource]
  if (typeof baseTranslation !== 'string' || typeof awakeningTranslation !== 'string') {
    skipped.push({ id, missingBase: typeof baseTranslation !== 'string', missingAwakening: typeof awakeningTranslation !== 'string' })
    continue
  }

  const runtimeItems = [
    ...standaloneItems(id, 'base', baseSource, baseTranslation),
    ...standaloneItems(id, 'awakening', awakeningSource, awakeningTranslation),
    ...comboItems(id, baseSource, awakeningSource, baseTranslation, awakeningTranslation),
  ]
  const seen = new Set()
  for (const item of runtimeItems) {
    if (seen.has(item.source)) continue
    seen.add(item.source)

    const current = translations[item.source]
    if (typeof current !== 'string') {
      translations[item.source] = item.target
      additions.push(item)
    } else if (args.force && current !== item.target) {
      translations[item.source] = item.target
      updates.push({ ...item, previous: current })
    }
  }
}

for (const [location, source] of Object.entries(entries)) {
  const match = location.match(/^m_character_abilities\/id:(\d+)\/3$/)
  if (!match || !isMeaningfulSource(source)) continue

  const translation = translations[source]
  if (typeof translation !== 'string' || translation === source) {
    skipped.push({ id: match[1], missingBase: true, missingAwakening: false })
    continue
  }

  for (const item of bondRewardItems(match[1], source, translation)) {
    const current = translations[item.source]
    if (typeof current !== 'string') {
      translations[item.source] = item.target
      additions.push(item)
    } else if (args.force && current !== item.target) {
      translations[item.source] = item.target
      updates.push({ ...item, previous: current })
    }
  }
}

console.log(
  `sync:limit-break-ability-combos additions=${additions.length} updates=${updates.length} skipped=${skipped.length} dryRun=${args.dryRun}`,
)

for (const item of additions.slice(0, 20)) {
  console.log(`[add] id=${item.id} ${JSON.stringify(item.source).slice(0, 180)}`)
}
for (const item of updates.slice(0, 20)) {
  console.log(`[update] id=${item.id} ${JSON.stringify(item.source).slice(0, 180)}`)
}
for (const item of skipped.slice(0, 20)) {
  console.log(`[skip] id=${item.id} missingBase=${item.missingBase} missingAwakening=${item.missingAwakening}`)
}

if (!args.dryRun && (additions.length || updates.length)) {
  writeJson(args.translations, translations)
}
