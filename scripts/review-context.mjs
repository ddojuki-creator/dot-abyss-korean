#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { compareProtectedTokens, collectEntries, parseArgs, readJson, readText, rel, setByPath, sha1, writeJson, ROOT } from './lib/ko-pipeline.mjs'

const API_KEY = process.env.OPENAI_API_KEY
const SCREEN_MODEL = process.env.OPENAI_REVIEW_SCREEN_MODEL || 'gpt-5.4-mini'
const REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || 'gpt-5.5'
const API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
const BATCH_SIZE = Number(process.env.REVIEW_BATCH_SIZE || 20)
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 4)
const STATE_FILE = path.join(ROOT, '.review-ko-state.json')
const REVIEW_VERSION = '2026-06-23.9'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { version: 1, reviewVersion: REVIEW_VERSION, screened: {}, corrected: {} }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  state.screened ||= {}
  state.corrected ||= {}
  return state
}

function saveState(state) {
  const temporaryFile = `${STATE_FILE}.tmp`
  fs.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  fs.renameSync(temporaryFile, STATE_FILE)
}

function loadInstructions() {
  const names = ['context-review.md', 'style-core.md', 'character-voice.md', 'character-cards.md', 'glossary.md', 'adult-content.md', 'tags-placeholders.md', 'forbidden.md']
  return names.map((name) => readText(path.join(ROOT, 'docs', 'translation', name))).join('\n\n---\n\n')
}

function targetFiles(args) {
  if (args.file) return [path.resolve(ROOT, args.file)]
  let files = fs.readdirSync(path.join(ROOT, 'translations', 'novels'))
    .filter((name) => name.startsWith('mas_'))
    .sort()
    .map((name) => path.join(ROOT, 'translations', 'novels', name, 'ko_KR.json'))
  if (args.limit != null) files = files.slice(0, args.limit)
  return files
}

function parseReviewArgs() {
  const raw = process.argv.slice(2)
  let stage = 'all'
  const rest = []
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '--stage') stage = raw[++i]
    else if (raw[i].startsWith('--stage=')) stage = raw[i].slice(8)
    else rest.push(raw[i])
  }
  if (!['screen', 'correct', 'all'].includes(stage)) throw new Error(`Invalid --stage: ${stage}`)
  return { ...parseArgs(rest, { scope: 'novels' }), stage }
}

async function callModel(model, system, payload) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }],
        }),
      })
      const text = await response.text()
      if (!response.ok) {
        const error = new Error(`OpenAI API ${response.status}: ${text.slice(0, 800)}`)
        if (text.includes('insufficient_quota')) error.noRetry = true
        throw error
      }
      const data = JSON.parse(text)
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI response has no content')
      return JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''))
    } catch (error) {
      lastError = error
      if (error.noRetry) throw error
      if (attempt < MAX_RETRIES) await sleep(Math.min(15000, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}

function fileHash(entries) {
  return sha1(JSON.stringify(entries.map(({ key, value }) => [key, value])))
}

async function screenFile(file, entries, instructions, state) {
  const hash = fileHash(entries)
  const saved = state.screened[rel(file)]
  if (saved?.hash === hash && saved?.model === SCREEN_MODEL && saved?.reviewVersion === REVIEW_VERSION) return saved.candidates

  const candidates = new Set()
  for (let offset = 0; offset < entries.length; offset += BATCH_SIZE) {
    const batch = entries.slice(offset, offset + BATCH_SIZE)
    process.stdout.write(`  screen ${offset + 1}-${offset + batch.length}/${entries.length} ... `)
    const result = await callModel(SCREEN_MODEL, `${instructions}\n\nIdentify only entries that clearly need expert review. Return {"candidate_ids":[0]}.`, {
      entries: batch.map((entry, id) => ({ id, source: entry.key, korean: entry.value })),
    })
    for (const id of result.candidate_ids || []) {
      if (Number.isInteger(id) && id >= 0 && id < batch.length) candidates.add(offset + id)
    }
    console.log(`candidates=${candidates.size}`)
  }
  state.screened[rel(file)] = { hash, model: SCREEN_MODEL, reviewVersion: REVIEW_VERSION, candidates: [...candidates] }
  saveState(state)
  return [...candidates]
}

async function correctFile(file, data, entries, candidateIndexes, instructions, state) {
  const inputHash = fileHash(entries)
  const saved = state.corrected[rel(file)]
  if (saved?.inputHash === inputHash && saved?.model === REVIEW_MODEL && saved?.reviewVersion === REVIEW_VERSION) return 0
  if (candidateIndexes.length === 0) {
    state.corrected[rel(file)] = { inputHash, model: REVIEW_MODEL, reviewVersion: REVIEW_VERSION, changed: 0 }
    saveState(state)
    return 0
  }

  let changed = 0
  const changeLog = []
  for (let offset = 0; offset < candidateIndexes.length; offset += BATCH_SIZE) {
    const targets = candidateIndexes.slice(offset, offset + BATCH_SIZE)
    const contextIndexes = new Set()
    for (const index of targets) {
      for (let i = Math.max(0, index - 2); i <= Math.min(entries.length - 1, index + 2); i += 1) contextIndexes.add(i)
    }
    const context = [...contextIndexes].sort((a, b) => a - b)
    process.stdout.write(`  correct ${offset + 1}-${offset + targets.length}/${candidateIndexes.length} ... `)
    const result = await callModel(REVIEW_MODEL, `${instructions}\n\nReview target entries using the supplied adjacent context. Return only necessary fixes as {"changes":[{"id":0,"value":"..."}]}. Omit correct entries.`, {
      context: context.map((index) => ({ index, source: entries[index].key, korean: entries[index].value })),
      targets: targets.map((index, id) => ({ id, context_index: index, source: entries[index].key, korean: entries[index].value })),
    })
    for (const change of result.changes || []) {
      const targetIndex = targets[Number(change.id)]
      if (!Number.isInteger(targetIndex) || typeof change.value !== 'string') continue
      const entry = entries[targetIndex]
      const tokenErrors = compareProtectedTokens(entry.key, change.value)
      if (tokenErrors.length) throw new Error(`${rel(file)} token mismatch: ${tokenErrors.join(', ')}`)
      if (change.value !== entry.value) {
        changeLog.push({ source: entry.key, before: entry.value, after: change.value })
        setByPath(data, entry.path, change.value)
        entry.value = change.value
        changed += 1
      }
    }
    writeJson(file, data)
    console.log(`changed=${changed}`)
  }
  state.corrected[rel(file)] = { inputHash: fileHash(entries), model: REVIEW_MODEL, reviewVersion: REVIEW_VERSION, changed, changes: changeLog }
  saveState(state)
  return changed
}

async function main() {
  const args = parseReviewArgs()
  const files = targetFiles(args)
  if (!args.dryRun && !API_KEY) throw new Error('OPENAI_API_KEY is required')
  console.log(`screenModel=${SCREEN_MODEL}`)
  console.log(`reviewModel=${REVIEW_MODEL}`)
  console.log(`stage=${args.stage}`)
  console.log(`targetFiles=${files.length}`)
  if (args.dryRun) return

  const instructions = loadInstructions()
  const state = loadState()
  let screened = 0
  let changed = 0
  for (const file of files) {
    const data = readJson(file)
    const entries = collectEntries(data)
    console.log(`\n${rel(file)} entries=${entries.length}`)
    let candidates = state.screened[rel(file)]?.candidates || []
    if (args.stage !== 'correct') candidates = await screenFile(file, entries, instructions, state)
    screened += candidates.length
    if (args.stage !== 'screen') changed += await correctFile(file, data, entries, candidates, instructions, state)
  }
  console.log(`\nreview:context screened=${screened} changed=${changed}`)
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
