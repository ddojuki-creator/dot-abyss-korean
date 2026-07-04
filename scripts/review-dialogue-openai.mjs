#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  collectEntries,
  compareProtectedTokens,
  ensureDir,
  readJson,
  readText,
  rel,
  sha1,
  walk,
} from './lib/ko-pipeline.mjs'

const API_KEY = process.env.OPENAI_API_KEY
const API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
let MODEL = process.env.OPENAI_DIALOGUE_REVIEW_MODEL || process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini'
let BATCH_SIZE = Number(process.env.DIALOGUE_REVIEW_BATCH_SIZE || 8)
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 4)
const CONTEXT_RADIUS = Number(process.env.DIALOGUE_REVIEW_CONTEXT_RADIUS || 2)
const REVIEW_VERSION = '2026-06-30.2'
const CACHE_DIR = path.join(ROOT, '.cache', 'dialogue-review')
const STATE_FILE = path.join(CACHE_DIR, 'state.json')

const instructionFiles = [
  'docs/translation/context-review.md',
  'docs/translation/style-core.md',
  'docs/translation/character-voice.md',
  'docs/translation/character-cards.md',
  'docs/translation/glossary.md',
  'docs/translation/adult-content.md',
  'docs/translation/tags-placeholders.md',
  'docs/translation/forbidden.md',
  'docs/translation/qa-checklist.md',
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(argv) {
  const args = {
    file: null,
    dir: null,
    limit: null,
    maxItems: null,
    maxBatches: null,
    batchSize: null,
    model: null,
    output: null,
    dryRun: false,
    force: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--file') args.file = next()
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length)
    else if (arg === '--dir') args.dir = next()
    else if (arg.startsWith('--dir=')) args.dir = arg.slice('--dir='.length)
    else if (arg === '--limit') args.limit = Number(next())
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length))
    else if (arg === '--max-items') args.maxItems = Number(next())
    else if (arg.startsWith('--max-items=')) args.maxItems = Number(arg.slice('--max-items='.length))
    else if (arg === '--max-batches') args.maxBatches = Number(next())
    else if (arg.startsWith('--max-batches=')) args.maxBatches = Number(arg.slice('--max-batches='.length))
    else if (arg === '--batch-size') args.batchSize = Number(next())
    else if (arg.startsWith('--batch-size=')) args.batchSize = Number(arg.slice('--batch-size='.length))
    else if (arg === '--model') args.model = next()
    else if (arg.startsWith('--model=')) args.model = arg.slice('--model='.length)
    else if (arg === '--output') args.output = next()
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length)
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--force') args.force = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }

  for (const key of ['limit', 'maxItems', 'maxBatches', 'batchSize']) {
    if (args[key] != null && (!Number.isInteger(args[key]) || args[key] < 0)) throw new Error(`Invalid --${key}: ${args[key]}`)
  }
  if (args.batchSize === 0) throw new Error('Invalid --batch-size: 0')
  return args
}

function printHelp() {
  console.log(`
Usage:
  node scripts/review-dialogue-openai.mjs [options]

Options:
  --file <path>        Review one ko_KR.json file.
  --dir <path>         Review ko_KR.json files under a directory.
  --limit <n>          Limit target files.
  --max-items <n>      Stop after selecting n pending entries.
  --max-batches <n>    Stop after n API batches. Useful for daily slices.
  --batch-size <n>     Items per API batch. Larger values reduce repeated instruction tokens.
  --model <model>      Override OPENAI_* model env vars for this run.
  --output <path>      JSONL suggestions output path.
  --force              Ignore saved done-state and review again.
  --dry-run            Print targets without calling OpenAI.

Environment:
  OPENAI_API_KEY
  OPENAI_DIALOGUE_REVIEW_MODEL=${MODEL}
  DIALOGUE_REVIEW_BATCH_SIZE=${BATCH_SIZE}
`)
}

function loadInstructions() {
  const body = instructionFiles
    .map((file) => `--- ${file} ---\n${readText(path.join(ROOT, file))}`)
    .join('\n\n')
  return {
    text: body,
    hash: sha1(`${REVIEW_VERSION}\n${body}`),
  }
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { version: 1, reviewVersion: REVIEW_VERSION, items: {}, errors: {} }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  state.items ||= {}
  state.errors ||= {}
  return state
}

function saveState(state) {
  ensureDir(CACHE_DIR)
  const temporaryFile = `${STATE_FILE}.tmp`
  fs.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  fs.renameSync(temporaryFile, STATE_FILE)
}

function defaultOutputFile() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return path.join(CACHE_DIR, `suggestions-${stamp}.jsonl`)
}

function resolveFromRoot(value) {
  return path.resolve(ROOT, value)
}

function targetFiles(args) {
  let files
  if (args.file) files = [resolveFromRoot(args.file)]
  else {
    const base = args.dir ? resolveFromRoot(args.dir) : path.join(ROOT, 'translations', 'novels')
    files = walk(base)
      .filter((file) => path.basename(file) === 'ko_KR.json')
      .sort()
  }
  if (args.limit != null) files = files.slice(0, args.limit)
  return files
}

function entryStateKey(file, entry) {
  return `${rel(file)}::${entry.path.join('\u0001')}`
}

function fingerprint(entry, instructionsHash) {
  return sha1(JSON.stringify({
    reviewVersion: REVIEW_VERSION,
    model: MODEL,
    instructionsHash,
    source: entry.key,
    value: entry.value,
  }))
}

function isDone(state, file, entry, instructionsHash, force) {
  if (force) return false
  const item = state.items[entryStateKey(file, entry)]
  return item?.status === 'done' && item?.fingerprint === fingerprint(entry, instructionsHash)
}

function buildPayload(targets) {
  return {
    rules: [
      'Review Korean game dialogue and narration against the Japanese source.',
      'Return fixes only for clear issues: mistranslation, omitted meaning, broken Korean, wrong term, wrong address, inconsistent speech level, or layout risk.',
      'Do not rewrite a line that is already accurate and natural.',
      'Preserve approved commander honorifics: 司令官殿=사령관공 and 司令官さん=사령관씨. Do not flatten them to 사령관님.',
      'If changed, suggested must be the full replacement Korean value.',
      'Preserve tags, placeholders, and control tokens. For novel dialogue, use at most one rendered line break.',
      'Do not remove or replace existing <br>, \\n, or other line-break tokens; keep their count and form.',
      'Do not propose style-only polish or line-break-only rewrites unless the current text is clearly wrong.',
      'Keep reasons short and concrete.',
    ],
    targets: targets.map(({ entry, index }, id) => {
      const sourceEntries = targets[id].entries
      const context = []
      const start = Math.max(0, index - CONTEXT_RADIUS)
      const end = Math.min(sourceEntries.length - 1, index + CONTEXT_RADIUS)
      for (let i = start; i <= end; i += 1) {
        context.push({
          index: i,
          source: sourceEntries[i].key,
          korean: sourceEntries[i].value,
          target: i === index,
        })
      }
      return {
        id,
        file: rel(targets[id].file),
        index,
        source: entry.key,
        korean: entry.value,
        context,
      }
    }),
  }
}

function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

async function callOpenAI(instructions, payload) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: [
                'You are an expert Korean localization reviewer for a Japanese 2D subculture game.',
                'Use the supplied project instructions as binding rules.',
                'Return JSON only with this schema: {"changes":[{"id":0,"severity":"low|medium|high","issue_types":["term"],"suggested":"...","reason":"..."}]}.',
                'Omit entries that do not require a change.',
                instructions,
              ].join('\n\n'),
            },
            {
              role: 'user',
              content: JSON.stringify(payload),
            },
          ],
        }),
      })
      const text = await response.text()
      if (!response.ok) {
        const error = new Error(`OpenAI API ${response.status}: ${text.slice(0, 1200)}`)
        if (text.includes('insufficient_quota')) error.noRetry = true
        throw error
      }
      const data = JSON.parse(text)
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI response has no message content')
      const parsed = JSON.parse(stripJsonFence(content))
      if (!Array.isArray(parsed.changes)) throw new Error('OpenAI response JSON has no changes array')
      return { changes: parsed.changes, usage: data.usage || null }
    } catch (error) {
      lastError = error
      if (error.noRetry) throw error
      if (attempt < MAX_RETRIES) await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}

function sanitizeChange(change, targets) {
  const id = Number(change.id)
  if (!Number.isInteger(id) || id < 0 || id >= targets.length) return null
  if (typeof change.suggested !== 'string' || change.suggested.length === 0) return null
  const target = targets[id]
  if (change.suggested === target.entry.value) return null
  const tokenErrors = compareProtectedTokens(target.entry.key, change.suggested, { lineBreaks: 'korean-dialogue', preserveLineBreakTokens: true })
  if (tokenErrors.length) return null
  return {
    id,
    file: rel(target.file),
    path: target.entry.path,
    source: target.entry.key,
    current: target.entry.value,
    suggested: change.suggested,
    severity: typeof change.severity === 'string' ? change.severity : 'medium',
    issue_types: Array.isArray(change.issue_types) ? change.issue_types.map(String) : [],
    reason: typeof change.reason === 'string' ? change.reason : '',
  }
}

function appendJsonLine(file, item) {
  ensureDir(path.dirname(file))
  fs.appendFileSync(file, `${JSON.stringify(item)}\n`, 'utf8')
}

function collectPending(files, state, instructionsHash, args) {
  const pending = []
  const fileStats = []
  for (const file of files) {
    const data = readJson(file)
    const entries = collectEntries(data)
    let selected = 0
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      if (typeof entry.value !== 'string') continue
      if (isDone(state, file, entry, instructionsHash, args.force)) continue
      pending.push({ file, entry, index, entries })
      selected += 1
      if (args.maxItems != null && pending.length >= args.maxItems) break
    }
    fileStats.push({ file, entries: entries.length, selected })
    if (args.maxItems != null && pending.length >= args.maxItems) break
  }
  return { pending, fileStats }
}

function markDone(state, target, instructionsHash, outputFile, suggestionCount) {
  state.items[entryStateKey(target.file, target.entry)] = {
    status: 'done',
    fingerprint: fingerprint(target.entry, instructionsHash),
    file: rel(target.file),
    path: target.entry.path,
    model: MODEL,
    reviewVersion: REVIEW_VERSION,
    instructionsHash,
    outputFile: rel(outputFile),
    suggestionCount,
    at: new Date().toISOString(),
  }
  delete state.errors[entryStateKey(target.file, target.entry)]
}

function markError(state, target, instructionsHash, error) {
  state.errors[entryStateKey(target.file, target.entry)] = {
    status: 'error',
    fingerprint: fingerprint(target.entry, instructionsHash),
    file: rel(target.file),
    path: target.entry.path,
    model: MODEL,
    reviewVersion: REVIEW_VERSION,
    instructionsHash,
    error: error.message,
    at: new Date().toISOString(),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.model) MODEL = args.model
  if (args.batchSize != null) BATCH_SIZE = args.batchSize
  if (args.help) {
    printHelp()
    return
  }

  const instructions = loadInstructions()
  const state = loadState()
  const files = targetFiles(args)
  const outputFile = args.output ? resolveFromRoot(args.output) : defaultOutputFile()
  const { pending, fileStats } = collectPending(files, state, instructions.hash, args)
  const runId = path.basename(outputFile, '.jsonl')

  console.log(`model=${MODEL}`)
  console.log(`reviewVersion=${REVIEW_VERSION}`)
  console.log(`instructionsHash=${instructions.hash}`)
  console.log(`targetFiles=${files.length}`)
  console.log(`pendingEntries=${pending.length}`)
  console.log(`batchSize=${BATCH_SIZE}`)
  console.log(`output=${rel(outputFile)}`)
  for (const stat of fileStats.slice(0, 20)) {
    if (stat.selected) console.log(`- ${rel(stat.file)} selected=${stat.selected}/${stat.entries}`)
  }
  if (fileStats.length > 20) console.log(`- ... ${fileStats.length - 20} more files`)

  if (args.dryRun) return
  if (!API_KEY) throw new Error('OPENAI_API_KEY is required unless --dry-run is used')

  ensureDir(CACHE_DIR)
  let reviewed = 0
  let suggestions = 0
  let failed = 0
  let batches = 0
  let skipped = 0
  const tokenUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  }

  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    if (args.maxBatches != null && batches >= args.maxBatches) break
    const batch = pending.slice(offset, offset + BATCH_SIZE)
    const targets = batch.map((target) => ({ ...target }))
    const payload = buildPayload(targets)
    process.stdout.write(`\nbatch ${batches + 1} items=${targets.length} ... `)
    try {
      const result = await callOpenAI(instructions.text, payload)
      const changes = result.changes
      if (result.usage) {
        tokenUsage.prompt_tokens += result.usage.prompt_tokens || 0
        tokenUsage.completion_tokens += result.usage.completion_tokens || 0
        tokenUsage.total_tokens += result.usage.total_tokens || 0
      }
      const byTargetId = new Map()
      for (const change of changes) {
        const sanitized = sanitizeChange(change, targets)
        if (!sanitized) {
          skipped += 1
          continue
        }
        sanitized.runId = runId
        sanitized.model = MODEL
        sanitized.reviewVersion = REVIEW_VERSION
        sanitized.instructionsHash = instructions.hash
        sanitized.at = new Date().toISOString()
        appendJsonLine(outputFile, sanitized)
        byTargetId.set(sanitized.id, (byTargetId.get(sanitized.id) || 0) + 1)
        suggestions += 1
      }
      for (let id = 0; id < targets.length; id += 1) markDone(state, targets[id], instructions.hash, outputFile, byTargetId.get(id) || 0)
      reviewed += targets.length
      saveState(state)
      console.log(`ok suggestions=${suggestions} skipped=${skipped} tokens=${tokenUsage.total_tokens}`)
    } catch (error) {
      failed += targets.length
      for (const target of targets) markError(state, target, instructions.hash, error)
      saveState(state)
      console.log('failed')
      console.error(error.message)
      if (error.noRetry) throw error
    }
    batches += 1
  }

  const latestFile = path.join(CACHE_DIR, 'latest.json')
  fs.writeFileSync(latestFile, `${JSON.stringify({
    runId,
    model: MODEL,
    reviewVersion: REVIEW_VERSION,
    instructionsHash: instructions.hash,
    outputFile: rel(outputFile),
    reviewed,
    suggestions,
    skipped,
    failed,
    tokenUsage,
    at: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8')

  console.log(`\nreview:dialogue-openai reviewed=${reviewed} suggestions=${suggestions} skipped=${skipped} failed=${failed} tokens=${tokenUsage.total_tokens}`)
  if (failed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
