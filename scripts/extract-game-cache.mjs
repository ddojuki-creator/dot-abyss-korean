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

const cacheFile = findCacheFile()
const outputFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')
const existing = fs.existsSync(outputFile) ? readJson(outputFile) : {}
const known = loadKnownTranslations(outputFile)
const decoded = decodeMessagePack(fs.readFileSync(cacheFile))
const { entries, tableReport } = extractLocations(decoded)
const previousSnapshot = fs.existsSync(snapshotFile) ? readJson(snapshotFile) : { entries: {} }
const previousEntries = new Map(Object.entries(previousSnapshot.entries || {}))
const diff = compareSnapshots(previousEntries, entries)
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
  baselineCreated: previousEntries.size === 0,
  counts: {
    locations: entries.size,
    uniqueStrings: extracted.size,
    addedLocations: diff.added.length,
    changedLocations: diff.changed.length,
    removedLocations: diff.removed.length,
    runtimeOnly: runtimeOnly.size,
    outputStrings: Object.keys(merged).length,
    untranslated,
  },
  tableReport,
  changes: diff,
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
console.log(`runtimeOnly=${runtimeOnly.size}`)
console.log(`total=${Object.keys(merged).length}`)
console.log(`preserved=${preserved}`)
console.log(`reused=${reused}`)
console.log(`untranslated=${untranslated}`)
console.log(`dryRun=${dryRun}`)
console.log(`snapshotOnly=${snapshotOnly}`)
