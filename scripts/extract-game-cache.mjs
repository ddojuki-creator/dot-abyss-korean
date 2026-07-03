#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { decodeMessagePack } from './lib/msgpack.mjs'
import { ROOT, readJson, writeJson } from './lib/ko-pipeline.mjs'

const japanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/
const excludedTables = [
  /^m_ng_words$/,
  /^m_payment_(googleplay|appstore)_products$/,
  /(?:^|_)text_colors?$/,
]
const snapshotFile = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const reportFile = path.join(ROOT, '.cache', 'game-cache-extract-report.json')

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function findCacheFile() {
  const explicit = option('--cache') || process.env.DOTABYSS_CACHE_FILE
  if (explicit) return path.resolve(explicit)
  const localLow = path.resolve(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), '..', 'LocalLow')
  const publisherDir = path.join(localLow, 'EXNOA LLC_')
  if (!fs.existsSync(publisherDir)) throw new Error(`Game publisher directory not found: ${publisherDir}`)
  const files = fs.readdirSync(publisherDir, { recursive: true })
    .filter((name) => String(name).endsWith('.dat') && String(name).includes(`DownloadCache${path.sep}`))
    .map((name) => path.join(publisherDir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  if (!files.length) throw new Error(`No game cache .dat found below ${publisherDir}`)
  return files[0]
}

function recordName(row, index, occurrences) {
  const candidate = Array.isArray(row) ? row[0] : null
  const stable = ['string', 'number', 'bigint'].includes(typeof candidate)
  if (!stable || String(candidate).length > 120) return `row:${index}`
  const base = `id:${String(candidate)}`
  const occurrence = occurrences.get(base) || 0
  occurrences.set(base, occurrence + 1)
  return occurrence === 0 ? base : `${base}#${occurrence}`
}

function collectLocatedStrings(value, location, output) {
  if (typeof value === 'string') {
    if (value.length <= 2000 && japanese.test(value)) output.set(location.join('/'), value)
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) collectLocatedStrings(value[i], [...location, String(i)], output)
    return
  }
  if (value && typeof value === 'object' && !(value instanceof Uint8Array)) {
    for (const key of Object.keys(value).sort()) collectLocatedStrings(value[key], [...location, key], output)
  }
}

function extractLocations(root) {
  const entries = new Map()
  const tableReport = {}
  for (const [table, value] of Object.entries(root)) {
    if (excludedTables.some((pattern) => pattern.test(table))) continue
    const before = entries.size
    if (Array.isArray(value)) {
      const occurrences = new Map()
      for (let i = 0; i < value.length; i++) {
        collectLocatedStrings(value[i], [table, recordName(value[i], i, occurrences)], entries)
      }
    } else {
      collectLocatedStrings(value, [table], entries)
    }
    const count = entries.size - before
    if (count) tableReport[table] = count
  }
  return { entries, tableReport }
}

function loadKnownTranslations(outgameFile) {
  const known = new Map()
  const translations = path.join(ROOT, 'translations')
  for (const file of fs.readdirSync(translations, { recursive: true })) {
    if (!String(file).endsWith(`${path.sep}ko_KR.json`) && file !== 'ko_KR.json') continue
    const full = path.join(translations, file)
    if (full.includes(`${path.sep}manifest${path.sep}`) || full === outgameFile) continue
    try {
      for (const [key, value] of Object.entries(readJson(full))) {
        if (typeof value === 'string' && value !== key && !known.has(key)) known.set(key, value)
      }
    } catch {}
  }
  return known
}

function sortedObject(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)))
}

function compareSnapshots(previous, current) {
  const added = []
  const changed = []
  const removed = []
  for (const [location, source] of current) {
    if (!previous.has(location)) added.push({ location, source })
    else if (previous.get(location) !== source) changed.push({ location, before: previous.get(location), after: source })
  }
  for (const [location, source] of previous) {
    if (!current.has(location)) removed.push({ location, source })
  }
  return { added, changed, removed }
}

function rowIdMap(rows) {
  const map = new Map()
  if (!Array.isArray(rows)) return map
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const id = row[0]
    if (['string', 'number', 'bigint'].includes(typeof id)) map.set(String(id), row)
  }
  return map
}

function buildCharacterSpecChanges(root, diff) {
  const characterRows = rowIdMap(root.m_characters)
  const abilityRows = rowIdMap(root.m_character_abilities)
  const actionSkillRows = rowIdMap(root.m_character_action_skills)
  const abilityDetailRows = rowIdMap(root.m_ability_details)
  const characterName = (id) => {
    const row = characterRows.get(String(id))
    return Array.isArray(row) ? row[1] : undefined
  }

  const abilityByGroup = new Map()
  for (const row of abilityRows.values()) {
    const abilityGroup = row[4]
    if (!['string', 'number', 'bigint'].includes(typeof abilityGroup)) continue
    abilityByGroup.set(String(abilityGroup), row)
  }

  function attachPayload(base, change) {
    if ('source' in change) return { ...base, source: change.source }
    return { ...base, before: change.before, after: change.after }
  }

  function annotate(change, changeType) {
    let match = change.location.match(/^m_character_action_skills\/id:([^/]+)\/(\d+)$/)
    if (match) {
      const row = actionSkillRows.get(match[1])
      if (!row) return null
      return attachPayload({
        changeType,
        location: change.location,
        table: 'm_character_action_skills',
        field: Number(match[2]),
        characterId: row[1],
        characterName: characterName(row[1]),
        skillId: row[0],
        skillName: row[3],
      }, change)
    }

    match = change.location.match(/^m_character_abilities\/id:([^/]+)\/(\d+)$/)
    if (match) {
      const row = abilityRows.get(match[1])
      if (!row) return null
      return attachPayload({
        changeType,
        location: change.location,
        table: 'm_character_abilities',
        field: Number(match[2]),
        characterId: row[1],
        characterName: characterName(row[1]),
        abilityId: row[0],
        abilityName: row[3],
        abilityGroup: row[4],
        abilitySlot: row[5],
      }, change)
    }

    match = change.location.match(/^m_ability_details\/id:([^/]+)\/(\d+)$/)
    if (match) {
      const row = abilityDetailRows.get(match[1])
      if (!row) return null
      const abilityRow = abilityByGroup.get(String(row[1]))
      if (!abilityRow) return null
      return attachPayload({
        changeType,
        location: change.location,
        table: 'm_ability_details',
        field: Number(match[2]),
        characterId: abilityRow[1],
        characterName: characterName(abilityRow[1]),
        abilityId: abilityRow[0],
        abilityName: abilityRow[3],
        abilityGroup: row[1],
        abilitySlot: abilityRow[5],
        abilityDetailId: row[0],
        limitBreakTier: row[2],
        abilityLevel: row[3],
      }, change)
    }

    return null
  }

  return [
    ...(diff.added || []).map((change) => annotate(change, 'added')),
    ...(diff.changed || []).map((change) => annotate(change, 'changed')),
    ...(diff.removed || []).map((change) => annotate(change, 'removed')),
  ].filter(Boolean)
}

function summarizeCharacterSpecChanges(changes) {
  const summary = new Map()
  for (const change of changes) {
    const key = [
      change.characterId ?? 'unknown',
      change.characterName ?? 'unknown',
      change.abilityName ?? change.skillName ?? 'unknown',
      change.table,
    ].join('\t')
    const item = summary.get(key) || {
      characterId: change.characterId,
      characterName: change.characterName,
      targetName: change.abilityName ?? change.skillName,
      table: change.table,
      changed: 0,
      added: 0,
      removed: 0,
      locations: [],
    }
    item[change.changeType] = (item[change.changeType] || 0) + 1
    if (item.locations.length < 8) item.locations.push(change.location)
    summary.set(key, item)
  }
  return [...summary.values()].sort((a, b) => {
    const aName = `${a.characterName ?? ''}\t${a.targetName ?? ''}\t${a.table ?? ''}`
    const bName = `${b.characterName ?? ''}\t${b.targetName ?? ''}\t${b.table ?? ''}`
    return aName.localeCompare(bName, 'ja')
  })
}

const cacheFile = findCacheFile()
const outputFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')
const previousSnapshotFile = option('--previous-snapshot') || snapshotFile
const existing = fs.existsSync(outputFile) ? readJson(outputFile) : {}
const known = loadKnownTranslations(outputFile)
const decoded = decodeMessagePack(fs.readFileSync(cacheFile))
const { entries, tableReport } = extractLocations(decoded)
const previousSnapshot = fs.existsSync(previousSnapshotFile) ? readJson(previousSnapshotFile) : { entries: {} }
const previousEntries = new Map(Object.entries(previousSnapshot.entries || {}))
const diff = compareSnapshots(previousEntries, entries)
const characterSpecChanges = buildCharacterSpecChanges(decoded, diff)
const characterSpecSummary = summarizeCharacterSpecChanges(characterSpecChanges)
const extracted = new Set(entries.values())
const previouslyManaged = new Set(previousEntries.values())

// Preserve runtime-collected strings that were never managed by the cache snapshot.
const runtimeOnly = new Set(Object.keys(existing).filter((key) => !previouslyManaged.has(key)))
const targetKeys = new Set([...extracted, ...runtimeOnly])
const merged = {}
let preserved = 0
let reused = 0
let untranslated = 0
for (const key of [...targetKeys].sort((a, b) => a.localeCompare(b, 'ja'))) {
  if (existing[key] && existing[key] !== key) {
    merged[key] = existing[key]
    preserved += 1
  } else if (known.has(key)) {
    merged[key] = known.get(key)
    reused += 1
  } else {
    merged[key] = key
    untranslated += 1
  }
}

const cacheBytes = fs.readFileSync(cacheFile)
const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  cacheSha256: crypto.createHash('sha256').update(cacheBytes).digest('hex'),
  entries: sortedObject(entries),
}
const report = {
  generatedAt: snapshot.generatedAt,
  cacheFile,
  cacheSha256: snapshot.cacheSha256,
  previousSnapshotFile,
  baselineCreated: previousEntries.size === 0,
  counts: {
    locations: entries.size,
    uniqueStrings: extracted.size,
    addedLocations: diff.added.length,
    changedLocations: diff.changed.length,
    removedLocations: diff.removed.length,
    characterSpecChanges: characterSpecChanges.length,
    runtimeOnly: runtimeOnly.size,
    outputStrings: Object.keys(merged).length,
    untranslated,
  },
  tableReport,
  changes: diff,
  characterSpecChanges,
  characterSpecSummary,
}

const dryRun = process.argv.includes('--dry-run')
const snapshotOnly = process.argv.includes('--snapshot-only')
if (!dryRun) {
  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true })
  fs.mkdirSync(path.dirname(reportFile), { recursive: true })
  if (!snapshotOnly) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true })
    writeJson(outputFile, merged)
  }
  fs.writeFileSync(snapshotFile, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

console.log(`cache=${cacheFile}`)
console.log(`tables=${Object.keys(tableReport).length}`)
console.log(`locations=${entries.size}`)
console.log(`uniqueStrings=${extracted.size}`)
console.log(`addedLocations=${diff.added.length}`)
console.log(`changedLocations=${diff.changed.length}`)
console.log(`removedLocations=${diff.removed.length}`)
console.log(`characterSpecChanges=${characterSpecChanges.length}`)
if (characterSpecSummary.length) {
  console.log('characterSpecSummary=')
  for (const item of characterSpecSummary) {
    console.log(`- ${item.characterName ?? 'unknown'} / ${item.targetName ?? 'unknown'} / ${item.table}: added=${item.added} changed=${item.changed} removed=${item.removed}`)
  }
}
console.log(`runtimeOnly=${runtimeOnly.size}`)
console.log(`total=${Object.keys(merged).length}`)
console.log(`preserved=${preserved}`)
console.log(`reused=${reused}`)
console.log(`untranslated=${untranslated}`)
console.log(`dryRun=${dryRun}`)
console.log(`snapshotOnly=${snapshotOnly}`)
