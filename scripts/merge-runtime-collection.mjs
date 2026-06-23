#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, writeJson } from './lib/ko-pipeline.mjs'

const defaultCollection = 'F:/DMMGamePlayer/dotabyss_x_cl/BepInEx/config/AbyssMod/outgame-ja_JP.json'
const collectionIndex = process.argv.indexOf('--collection')
const collectionFile = path.resolve(
  collectionIndex >= 0 ? process.argv[collectionIndex + 1] : defaultCollection,
)
const dryRun = process.argv.includes('--dry-run')
const targetFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')

if (!fs.existsSync(collectionFile)) throw new Error(`Runtime collection not found: ${collectionFile}`)

const collected = JSON.parse(fs.readFileSync(collectionFile, 'utf8'))
const target = JSON.parse(fs.readFileSync(targetFile, 'utf8'))
let added = 0

for (const source of Object.keys(collected)) {
  if (source in target || source.trim() === '') continue
  target[source] = source
  added += 1
}

if (!dryRun && added > 0) writeJson(targetFile, target)
console.log(`merge:runtime collected=${Object.keys(collected).length} added=${added} dryRun=${dryRun}`)
