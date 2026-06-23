#!/usr/bin/env node
import fs from 'node:fs'
import { collectEntries, compareProtectedTokens, getTargetFiles, isManifest, isPlainObject, parseArgs, printSummary, readJson, rel, upstreamFileForKoFile } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))
const files = getTargetFiles(args)
let checkedFiles = 0
let checkedItems = 0
let parseErrors = 0
let invalidShape = 0
let keyErrors = 0
let emptyValues = 0
let nonStringValues = 0
let tokenErrors = 0
const samples = []

for (const file of files) {
  if (isManifest(file)) continue
  let data
  try {
    data = readJson(file)
  } catch (err) {
    parseErrors += 1
    samples.push(`${rel(file)}: parse error: ${err.message}`)
    continue
  }
  if (!isPlainObject(data)) {
    invalidShape += 1
    samples.push(`${rel(file)}: not a JSON object`)
    continue
  }
  checkedFiles += 1

  const upstreamFile = upstreamFileForKoFile(file)
  let source = null
  if (fs.existsSync(upstreamFile)) {
    source = readJson(upstreamFile)
    const targetKeys = JSON.stringify(collectEntries(data).map((entry) => entry.path.join('\u0001')).sort())
    const sourceKeys = JSON.stringify(collectEntries(source).map((entry) => entry.path.join('\u0001')).sort())
    if (targetKeys !== sourceKeys) {
      keyErrors += 1
      samples.push(`${rel(file)}: keys differ from upstream`)
    }
  }

  for (const entry of collectEntries(data)) {
    checkedItems += 1
    if (typeof entry.value !== 'string') {
      nonStringValues += 1
      samples.push(`${rel(file)} :: ${entry.path.join(' > ')}: non-string value`)
      continue
    }
    if (entry.value === '') {
      emptyValues += 1
      samples.push(`${rel(file)} :: ${entry.path.join(' > ')}: empty value`)
    }
    const tokenProblems = compareProtectedTokens(entry.key, entry.value)
    if (tokenProblems.length) {
      tokenErrors += 1
      samples.push(`${rel(file)} :: ${entry.path.join(' > ')}: ${tokenProblems.join(', ')}`)
    }
  }
}

printSummary('validate:ko', {
  checkedFiles,
  checkedItems,
  parseErrors,
  invalidShape,
  keyErrors,
  nonStringValues,
  emptyValues,
  tokenErrors,
})

if (samples.length) {
  console.log('\nSamples:')
  for (const sample of samples.slice(0, 40)) console.log(`- ${sample}`)
}

if (parseErrors || invalidShape || keyErrors || nonStringValues || emptyValues || tokenErrors) process.exitCode = 1
