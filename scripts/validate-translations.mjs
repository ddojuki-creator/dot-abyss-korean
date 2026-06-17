#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const targetLanguage = 'ko_KR'
const translationDir = path.join(ROOT, 'translations')
const manifestFile = path.join(translationDir, 'manifest', `${targetLanguage}.json`)

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(fullPath))
    else files.push(fullPath)
  }
  return files
}

function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/') }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function isManifest(file) { return path.resolve(file) === path.resolve(manifestFile) }
function isKoJson(file) { return file.endsWith(`${path.sep}${targetLanguage}.json`) }

function collectEntries(data, prefix = []) {
  const out = []
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out
  for (const [key, value] of Object.entries(data)) {
    const p = [...prefix, key]
    if (typeof value === 'string') out.push({ path: p, key, value })
    else if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...collectEntries(value, p))
    else out.push({ path: p, key, value })
  }
  return out
}

function extractTagTokens(s) {
  if (typeof s !== 'string') return []
  const patterns = [
    /<\s*\/?\s*(?:br|user|color|size|sprite|font|b|i|u|s|mark|mspace|voffset|align|alpha|cspace|indent|line-height|line-indent|link|lowercase|uppercase|smallcaps|margin|noparse|nobr|page|pos|rotate|space|style|sub|sup|width)(?:\s+[^>]*)?>/gi,
    /%[A-Za-z0-9_]+%/g,
    /\{[A-Za-z0-9_]+\}/g,
    /\$\{[^}]+\}/g,
    /\\[nrt]/g
  ]
  const tokens = []
  for (const re of patterns) for (const m of s.matchAll(re)) tokens.push(m[0])
  return tokens
}

function counts(list) {
  const m = new Map()
  for (const x of list) m.set(x, (m.get(x) || 0) + 1)
  return m
}

function compareTokenSet(key, value) {
  // 이 프로젝트는 일본어 원문이 key, 번역문이 value인 구조라 key의 태그가 value에도 유지되어야 한다.
  if (typeof key !== 'string' || typeof value !== 'string') return []
  const a = counts(extractTagTokens(key))
  const b = counts(extractTagTokens(value))
  const errors = []
  for (const [token, n] of a) {
    if ((b.get(token) || 0) !== n) errors.push(`${token}: key=${n} value=${b.get(token) || 0}`)
  }
  return errors
}

let checked = 0
let itemCount = 0
let emptyValues = 0
let invalidShape = 0
let nonStringValues = 0
let tokenErrors = 0
let manifestIncluded = false
const invalidFiles = []
const tokenErrorSamples = []
const parseErrors = []

for (const target of walk(translationDir).sort()) {
  if (!isKoJson(target)) continue
  if (isManifest(target)) {
    manifestIncluded = true
    continue
  }

  let targetData
  try { targetData = readJson(target) }
  catch (err) {
    parseErrors.push(`${rel(target)}: ${err.message}`)
    continue
  }

  if (!targetData || typeof targetData !== 'object' || Array.isArray(targetData)) {
    invalidShape += 1
    invalidFiles.push(rel(target))
    continue
  }

  checked += 1
  for (const entry of collectEntries(targetData)) {
    itemCount += 1
    if (typeof entry.value !== 'string') {
      nonStringValues += 1
      continue
    }
    if (entry.value === '') emptyValues += 1
    const errs = compareTokenSet(entry.key, entry.value)
    if (errs.length) {
      tokenErrors += 1
      if (tokenErrorSamples.length < 20) tokenErrorSamples.push(`${rel(target)} :: ${entry.path.join(' > ')} :: ${errs.join(', ')}`)
    }
  }
}

console.log(`checked_files=${checked}`)
console.log(`checked_items=${itemCount}`)
console.log(`manifest_excluded_from_validation=${manifestIncluded}`)
console.log(`parse_errors=${parseErrors.length}`)
console.log(`invalid_shape=${invalidShape}`)
console.log(`non_string_values=${nonStringValues}`)
console.log(`empty_values=${emptyValues}`)
console.log(`token_errors=${tokenErrors}`)

if (parseErrors.length) {
  console.log('\nParse errors:')
  for (const e of parseErrors.slice(0, 20)) console.log(`- ${e}`)
}
if (invalidFiles.length) {
  console.log('\nInvalid files:')
  for (const file of invalidFiles.slice(0, 20)) console.log(`- ${file}`)
}
if (tokenErrorSamples.length) {
  console.log('\nToken error samples:')
  for (const e of tokenErrorSamples) console.log(`- ${e}`)
}

if (parseErrors.length || invalidFiles.length || nonStringValues || tokenErrors) process.exitCode = 1
