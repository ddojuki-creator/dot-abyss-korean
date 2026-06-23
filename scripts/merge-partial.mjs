#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { collectEntries, compareProtectedTokens, getByPath, isKoJson, isManifest, isPlainObject, parseArgs, printSummary, readJson, rel, setByPath, walk, writeJson } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2), { dir: null })
if (!args.dir) throw new Error('Usage: npm run merge:partial -- --dir PATH [--dry-run]')

const partialRoot = path.resolve(process.cwd(), args.dir)
if (!fs.existsSync(partialRoot)) throw new Error(`Partial directory not found: ${args.dir}`)

let files = walk(partialRoot).filter(isKoJson).filter((file) => !isManifest(file)).sort()
if (args.limit != null) files = files.slice(0, args.limit)

let mergedFiles = 0
let mergedValues = 0
let skipped = 0
const samples = []

for (const partialFile of files) {
  const relative = path.relative(partialRoot, partialFile)
  const targetFile = path.join(process.cwd(), relative)
  if (!fs.existsSync(targetFile)) {
    skipped += 1
    samples.push(`${relative}: target missing`)
    continue
  }
  const partial = readJson(partialFile)
  const target = readJson(targetFile)
  if (!isPlainObject(partial) || !isPlainObject(target)) {
    skipped += 1
    samples.push(`${relative}: non-object JSON`)
    continue
  }

  const partialKeys = JSON.stringify(collectEntries(partial).map((entry) => entry.path.join('\u0001')).sort())
  const targetKeys = JSON.stringify(collectEntries(target).map((entry) => entry.path.join('\u0001')).sort())
  if (partialKeys !== targetKeys) {
    skipped += 1
    samples.push(`${relative}: keys differ`)
    continue
  }

  let changed = 0
  for (const entry of collectEntries(partial)) {
    const value = entry.value
    if (typeof value !== 'string' || !/[\uac00-\ud7a3]/.test(value)) continue
    const current = getByPath(target, entry.path)
    const tokenErrors = compareProtectedTokens(entry.key, value)
    if (tokenErrors.length) {
      skipped += 1
      samples.push(`${relative} :: ${entry.path.join(' > ')}: token mismatch`)
      continue
    }
    if (current !== value) {
      setByPath(target, entry.path, value)
      changed += 1
    }
  }

  if (changed) {
    mergedFiles += 1
    mergedValues += changed
    if (!args.dryRun) writeJson(targetFile, target)
  }
}

printSummary('merge:partial', { files: files.length, mergedFiles, mergedValues, skipped, dryRun: args.dryRun })
if (samples.length) {
  console.log('\nSamples:')
  for (const sample of samples.slice(0, 30)) console.log(`- ${sample}`)
}
