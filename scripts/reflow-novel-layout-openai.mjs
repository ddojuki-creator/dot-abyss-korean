#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  collectEntries,
  compareProtectedTokens,
  readJson,
  rel,
  setByPath,
  shouldTranslateValue,
  writeJson,
} from './lib/ko-pipeline.mjs'

const API_KEY = process.env.OPENAI_API_KEY
const API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_LAYOUT_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const BATCH_SIZE = Number(process.env.NOVEL_LAYOUT_BATCH_SIZE || 10)
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 4)
const TARGET = Number(process.env.NOVEL_LAYOUT_TARGET || 34)
const HARD_LIMIT = Number(process.env.NOVEL_LAYOUT_HARD_LIMIT || 36)
const REPORT_FILE = path.join(ROOT, '.cache', 'novel-layout-review.json')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(argv) {
  const args = { dryRun: false, maxItems: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--max-items') args.maxItems = Number(next())
    else if (arg.startsWith('--max-items=')) args.maxItems = Number(arg.slice('--max-items='.length))
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (args.maxItems != null && (!Number.isInteger(args.maxItems) || args.maxItems < 0)) {
    throw new Error(`Invalid --max-items: ${args.maxItems}`)
  }
  return args
}

function printHelp() {
  console.log(`
Usage:
  node scripts/reflow-novel-layout-openai.mjs [--dry-run] [--max-items <n>]

Reads .cache/novel-layout-review.json and rewrites manual novel dialogue layout
issues so every displayed Korean line is <= ${HARD_LIMIT} chars and each value
uses at most one rendered line break.
`)
}

function visibleLength(value) {
  return [...String(value).replace(/<[^>]+>/g, '')].length
}

function splitRenderedLines(value) {
  return String(value)
    .split(/<br\s*\/?\s*>|\\n|\r?\n/gi)
    .map((line) => line.trim())
    .filter(Boolean)
}

function renderedBreakCount(value) {
  return String(value).match(/<br\s*\/?\s*>|\\n|\r?\n/gi)?.length || 0
}

function hasAwkwardBreak(value) {
  const lines = splitRenderedLines(value)
  if (lines.length < 2) return false
  return lines.slice(1).some((line) => /^(?:은|는|이|가|을|를|와|과|로|으로|에|에게|께|도|만|부터|까지|처럼|보다|조차|마저)(?:\s|[,.!?…]|$)/.test(line))
}

function layoutErrors(value) {
  const lines = splitRenderedLines(value)
  const lengths = lines.map(visibleLength)
  const errors = []
  if (lines.length > 2) errors.push(`lines=${lines.length}, max=2`)
  if (renderedBreakCount(value) > 1) errors.push(`breaks=${renderedBreakCount(value)}, max=1`)
  const over = lengths.filter((length) => length > HARD_LIMIT)
  if (over.length) errors.push(`line-lengths=${lengths.join('/')}, max=${HARD_LIMIT}`)
  if (hasAwkwardBreak(value)) errors.push('awkward-break')
  return errors
}

function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function findEntry(data, issue) {
  if (Object.prototype.hasOwnProperty.call(data, issue.source)) return { path: [issue.source], value: data[issue.source] }
  const found = collectEntries(data).find((entry) => entry.key === issue.source)
  if (!found) return null
  return { path: found.path, value: found.value }
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function buildMessages(items, retryNotes = []) {
  return [
    {
      role: 'system',
      content: [
        'You are a professional Korean localizer for a Japanese 2D subculture game.',
        'Rewrite Korean novel dialogue/narration only to fix layout risk.',
        `Each displayed Korean line must be <= ${HARD_LIMIT} visible Korean characters after removing tags. Target about ${TARGET} characters.`,
        `Spaces and punctuation count as visible characters. The whole value usually must be <= ${HARD_LIMIT * 2} visible characters to fit two lines.`,
        'Use at most one rendered line break: <br>. One line is allowed if it fits.',
        `The ${HARD_LIMIT}-character limit is per displayed line, not per whole value.`,
        `A 23/${HARD_LIMIT + 12} split is invalid because the second line is over ${HARD_LIMIT}. Return balanced lengths like ${TARGET - 2}/${TARGET}, ${TARGET}/${HARD_LIMIT}, or one line under ${HARD_LIMIT}.`,
        `Never return three displayed lines. The value may contain zero or one <br> only.`,
        `If a faithful full sentence cannot fit within two ${HARD_LIMIT}-character lines, shorten wording while preserving the core meaning and voice.`,
        'Prefer concise Korean phrasing over literal Japanese structure when layout is tight.',
        'Do not split words, particles, endings, or short word tails across <br>.',
        'Preserve meaning, emotional tone, speaker voice, honorifics, adult nuance, tags, placeholders, and symbols.',
        'Do not add new story information. Do not censor explicit adult text.',
        'Keep Korean natural and concise; compress aggressively when needed instead of creating a third line or an overlong second line.',
        'If every detail cannot fit, keep the core event, emotion, and subject/object relationship while trimming redundant modifiers.',
        'Return JSON only: {"items":[{"id":0,"value":"..."}]}. Return one item for every id.',
        ...retryNotes,
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        items: items.map((item) => ({
          id: item.id,
          file: item.file,
          source: item.source,
          current: item.current,
          current_line_lengths: splitRenderedLines(item.current).map(visibleLength),
        })),
      }, null, 2),
    },
  ]
}

async function callOpenAI(items, retryNotes = []) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: buildMessages(items, retryNotes),
    }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 1200)}`)
  const data = JSON.parse(text)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI response has no message content')
  const parsed = JSON.parse(stripJsonFence(content))
  if (!Array.isArray(parsed.items)) throw new Error('OpenAI response JSON has no items array')
  const byId = new Map(parsed.items.map((item) => [Number(item.id), item.value]))
  return items.map((item) => {
    const value = byId.get(item.id)
    if (typeof value !== 'string') throw new Error(`Missing value for id=${item.id}`)
    return value
  })
}

async function rewriteBatch(items, retryNotes = []) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await callOpenAI(items, retryNotes)
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES) await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}

function validateSuggestion(item, value) {
  const errors = []
  errors.push(...compareProtectedTokens(item.current, value, { lineBreaks: 'korean-dialogue' }))
  errors.push(...layoutErrors(value))
  if (shouldTranslateValue(item.source, value)) errors.push('untranslated-japanese')
  return errors
}

async function rewriteWithValidation(batch) {
  const first = await rewriteBatch(batch)
  const result = []
  const failed = []

  for (let i = 0; i < batch.length; i += 1) {
    const item = batch[i]
    const value = first[i]
    const errors = validateSuggestion(item, value)
    if (errors.length) failed.push({ item, value, errors })
    else result.push({ item, value })
  }

  for (const fail of failed) {
    let retryValue = fail.value
    let retryErrors = fail.errors
    for (let attempt = 1; attempt <= MAX_RETRIES && retryErrors.length; attempt += 1) {
      const notes = [
        `Previous suggestion failed validation: ${retryErrors.join(', ')}`,
        `Invalid previous suggestion: ${retryValue}`,
        `Rewrite again with stronger compression. Absolute rules: max 2 displayed lines, max 1 <br>, each line <= ${HARD_LIMIT} visible chars.`,
        'It is acceptable to trim redundant modifiers, shorten clauses, and combine repeated ideas.',
      ]
      ;[retryValue] = await rewriteBatch([fail.item], notes)
      retryErrors = validateSuggestion(fail.item, retryValue)
    }
    if (retryErrors.length) result.push({ item: fail.item, value: retryValue, errors: retryErrors })
    else result.push({ item: fail.item, value: retryValue })
  }

  return result
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }
  if (!args.dryRun && !API_KEY) throw new Error('OPENAI_API_KEY is required unless --dry-run is used')

  const report = readJson(REPORT_FILE)
  const issues = report.issues
    .filter((issue) => issue.status === 'manual')
    .slice(0, args.maxItems ?? undefined)

  const targets = []
  for (const [id, issue] of issues.entries()) {
    const fileAbs = path.join(ROOT, issue.file)
    const data = readJson(fileAbs)
    const entry = findEntry(data, issue)
    if (!entry) {
      targets.push({ id, issue, missing: true })
      continue
    }
    targets.push({
      id,
      file: issue.file,
      fileAbs,
      source: issue.source,
      current: entry.value,
      path: entry.path,
      currentLengths: splitRenderedLines(entry.value).map(visibleLength),
    })
  }

  const pending = targets.filter((target) => !target.missing && layoutErrors(target.current).length > 0)
  console.log('reflow:novel-layout-openai')
  console.log(`model=${MODEL}`)
  console.log(`targets=${targets.length}`)
  console.log(`pending=${pending.length}`)
  console.log(`dryRun=${args.dryRun}`)
  if (args.dryRun || pending.length === 0) return

  let applied = 0
  let failed = 0
  const changed = new Map()

  for (const batch of chunk(pending, BATCH_SIZE)) {
    const results = await rewriteWithValidation(batch)
    for (const result of results) {
      if (result.errors?.length) {
        failed += 1
        console.warn(`[skip] ${result.item.file} :: ${result.errors.join(', ')}`)
        console.warn(`  ${result.value}`)
        continue
      }
      if (result.value === result.item.current) continue
      let record = changed.get(result.item.fileAbs)
      if (!record) {
        record = { data: readJson(result.item.fileAbs), count: 0 }
        changed.set(result.item.fileAbs, record)
      }
      setByPath(record.data, result.item.path, result.value)
      record.count += 1
      applied += 1
    }
    console.log(`processed=${Math.min(applied + failed, pending.length)} applied=${applied} failed=${failed}`)
  }

  for (const [file, record] of changed) writeJson(file, record.data)

  console.log(`applied=${applied}`)
  console.log(`failed=${failed}`)
  console.log(`changedFiles=${changed.size}`)
  for (const [file, record] of [...changed.entries()].slice(0, 20)) {
    console.log(`- ${rel(file)}: ${record.count}`)
  }
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exit(1)
})
