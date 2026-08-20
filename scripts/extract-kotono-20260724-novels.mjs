#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, writeJson } from './lib/ko-pipeline.mjs'

const NOVEL_IDS = [
  'hmn_10110100001',
  'hmn_10110100002',
  'hmn_10110100003',
  'hmr_10110100011',
  'hmr_10110100012',
  'hmr_10110100013',
  'hmr_10110100021',
  'hmr_10110100022',
  'hmr_10110100023',
  'hmr_10110100031',
  'hmr_10110100032',
  'hmr_10110100033',
  'men_10110100001',
  'men_10110100002',
  'men_10110100003',
  'evs_10600010101',
]

const force = process.argv.includes('--force')
const indexFile = path.join(ROOT, '.cache', 'novel-message-index.json')
if (!fs.existsSync(indexFile)) {
  throw new Error(`Missing novel message index: ${indexFile}`)
}

const rows = readJson(indexFile)
let written = 0
let skipped = 0

for (const novelId of NOVEL_IDS) {
  const sources = rows
    .filter((row) => row?.novelId === novelId && typeof row.source === 'string')
    .sort((a, b) => Number(a.line || 0) - Number(b.line || 0))
    .map((row) => row.source)

  if (sources.length === 0) {
    throw new Error(`No indexed dialogue found for ${novelId}`)
  }

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

console.log(`done: written=${written} skipped=${skipped}`)
