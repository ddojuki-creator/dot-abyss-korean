#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, writeJson } from './lib/ko-pipeline.mjs'

const characterIds = process.argv.slice(2).filter((arg) => /^\d{4}$/.test(arg))
const force = process.argv.includes('--force')

if (characterIds.length === 0) {
  throw new Error('Usage: node scripts/extract-character-novels.mjs <character-id> [...] [--force]')
}

const indexFile = path.join(ROOT, '.cache', 'novel-message-index.json')
if (!fs.existsSync(indexFile)) {
  throw new Error(`Missing novel message index: ${indexFile}`)
}

const rows = readJson(indexFile)
const targetPattern = new RegExp(`^(?:hmn|hmr|men)_(?:${characterIds.join('|')})`)
const novelIds = [...new Set(
  rows
    .map((row) => row?.novelId)
    .filter((novelId) => typeof novelId === 'string' && targetPattern.test(novelId)),
)].sort()

if (novelIds.length === 0) {
  throw new Error(`No indexed character novels found for: ${characterIds.join(', ')}`)
}

let written = 0
let skipped = 0

for (const novelId of novelIds) {
  const sources = rows
    .filter((row) => row?.novelId === novelId && typeof row.source === 'string')
    .sort((a, b) => Number(a.line || 0) - Number(b.line || 0))
    .map((row) => row.source)

  const outputFile = path.join(ROOT, 'translations', 'novels', novelId, 'ko_KR.json')
  if (fs.existsSync(outputFile) && !force) {
    skipped++
    console.log(`skip ${novelId}: already exists`)
    continue
  }

  const data = {}
  for (const source of sources) {
    if (!(source in data)) data[source] = source
  }
  writeJson(outputFile, data)
  written++
  console.log(`write ${novelId}: ${Object.keys(data).length} unique dialogue entries`)
}

console.log(`done: targets=${characterIds.length} novels=${novelIds.length} written=${written} skipped=${skipped}`)
