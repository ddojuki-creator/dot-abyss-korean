#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  compareProtectedTokens,
  ensureDir,
  readJson,
  readText,
} from './lib/ko-pipeline.mjs'

const API_KEY = process.env.OPENAI_API_KEY
const API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_DIALOGUE_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-5.4-mini'
const BATCH_SIZE = Number(process.env.DIALOGUE_VERIFY_BATCH_SIZE || 10)
const BATCH_DELAY_MS = Number(process.env.DIALOGUE_VERIFY_BATCH_DELAY_MS || 10000)
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 4)

function parseArgs(argv) {
  const args = { input: null, output: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`)
      return argv[++i]
    }
    if (arg === '--input') args.input = next()
    else if (arg.startsWith('--input=')) args.input = arg.slice('--input='.length)
    else if (arg === '--output') args.output = next()
    else if (arg.startsWith('--output=')) args.output = arg.slice('--output='.length)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!args.input || !args.output) throw new Error('Usage: --input <suggestions.jsonl> --output <verified.jsonl>')
  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function readJsonLines(file) {
  return readText(file)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function normalizeKotonoAddress(source, value, speakers) {
  if (speakers.length !== 1 || speakers[0] !== 'コトノ') return value
  let normalized = value
  if (source.includes('<user>殿')) normalized = normalized.replace(/<user>(?:님|공)/g, '<user>공')
  if (/旦那(?:様|さま)?/.test(source)) {
    normalized = normalized
      .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)께서/g, '주군께서')
      .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)께/g, '주군께')
      .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)의/g, '주군의')
      .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)(?:과|와)/g, '주군과')
      .replace(/나리를/g, '주군을')
      .replace(/나리는/g, '주군은')
      .replace(/나리가/g, '주군이')
      .replace(/(?:서방님|주인님|주군님|남편님|나리님|서방|남편|여보|나리)/g, '주군')
      .replace(/주군를/g, '주군을')
      .replace(/주군는/g, '주군은')
      .replace(/주군가/g, '주군이')
      .replace(/주군와/g, '주군과')
  }
  return normalized
}

function buildSpeakerIndex() {
  const indexFile = path.join(ROOT, '.cache', 'novel-message-index.json')
  const result = new Map()
  for (const row of readJson(indexFile)) {
    if (!row?.novelId || typeof row.source !== 'string') continue
    const key = `${row.novelId}\u0000${row.source}`
    if (!result.has(key)) result.set(key, new Set())
    if (row.speaker) result.get(key).add(row.speaker)
  }
  return result
}

function loadInstructions() {
  const files = [
    'docs/translation/style-core.md',
    'docs/translation/character-cards.md',
    'docs/translation/glossary.md',
    'docs/translation/adult-content.md',
    'docs/translation/tags-placeholders.md',
    'docs/translation/forbidden.md',
  ]
  return files.map((file) => `--- ${file} ---\n${readText(path.join(ROOT, file))}`).join('\n\n')
}

function productionRecord(row, speakerIndex) {
  const novelId = path.basename(path.dirname(row.file))
  const file = path.join(ROOT, 'translations', 'novels', novelId, 'ko_KR.json')
  const data = readJson(file)
  if (!(row.source in data)) throw new Error(`Source key not found in ${file}`)
  const entries = Object.entries(data)
  const index = entries.findIndex(([source]) => source === row.source)
  const speakers = [...(speakerIndex.get(`${novelId}\u0000${row.source}`) || [])].sort()
  return {
    novelId,
    file,
    source: row.source,
    current: data[row.source],
    candidate: normalizeKotonoAddress(row.source, row.suggested, speakers),
    speakers,
    before: index > 0 ? { source: entries[index - 1][0], korean: entries[index - 1][1] } : null,
    after: index >= 0 && index + 1 < entries.length ? { source: entries[index + 1][0], korean: entries[index + 1][1] } : null,
    firstReason: row.reason || '',
    firstSeverity: row.severity || 'medium',
  }
}

async function callOpenAI(instructions, targets) {
  const payload = {
    fixed_rules: [
      'For Kotono only: before her loyalty pledge, <user>殿 is <user>공.',
      'For Kotono only: after her loyalty pledge, 旦那様 and 旦那 are 주군.',
      'Never reinterpret Kotono as Kureha. Kotono does not use 서방님.',
      'Reject a candidate that translates a neighboring line instead of the target source.',
      'Reject a candidate that changes protected tags such as <ruby=...>...</> or placeholders.',
      'Accept only a clear correction of meaning, terminology, Korean grammar, character voice, or severe readability.',
      'Do not accept preference-only rewrites.',
    ],
    targets: targets.map((target, id) => ({
      id,
      novel_id: target.novelId,
      speakers: target.speakers,
      source: target.source,
      current: target.current,
      candidate: target.candidate,
      first_review_reason: target.firstReason,
      context_before: target.before,
      context_after: target.after,
    })),
  }

  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
                'You are the final adjudicator for Japanese-to-Korean game localization review suggestions.',
                'For every target, return exactly one decision: accept, reject, or replace.',
                'Use replace only when both current and candidate are wrong; replacement must be the full Korean value.',
                'Return JSON only: {"decisions":[{"id":0,"action":"accept|reject|replace","replacement":"","reason":"..."}]}.',
                instructions,
              ].join('\n\n'),
            },
            { role: 'user', content: JSON.stringify(payload) },
          ],
        }),
      })
      const text = await response.text()
      if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 1200)}`)
      const data = JSON.parse(text)
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI response has no content')
      const parsed = JSON.parse(stripJsonFence(content))
      if (!Array.isArray(parsed.decisions)) throw new Error('OpenAI response has no decisions array')
      return parsed.decisions
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES) await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!API_KEY) throw new Error('OPENAI_API_KEY is required')
  const input = path.resolve(ROOT, args.input)
  const output = path.resolve(ROOT, args.output)
  const rows = readJsonLines(input)
  const speakerIndex = buildSpeakerIndex()
  const instructions = loadInstructions()
  const records = rows.map((row) => productionRecord(row, speakerIndex))
  ensureDir(path.dirname(output))
  fs.writeFileSync(output, '', 'utf8')

  let accepted = 0
  let rejected = 0
  let replaced = 0
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE)
    process.stdout.write(`batch ${Math.floor(offset / BATCH_SIZE) + 1} items=${batch.length} ... `)
    const decisions = await callOpenAI(instructions, batch)
    const byId = new Map(decisions.map((decision) => [Number(decision.id), decision]))
    for (let id = 0; id < batch.length; id++) {
      const target = batch[id]
      const decision = byId.get(id) || { action: 'reject', reason: 'missing verifier decision' }
      let action = ['accept', 'reject', 'replace'].includes(decision.action) ? decision.action : 'reject'
      let finalValue = action === 'accept' ? target.candidate : target.current
      if (action === 'replace' && typeof decision.replacement === 'string' && decision.replacement) {
        finalValue = normalizeKotonoAddress(target.source, decision.replacement, target.speakers)
      } else if (action === 'replace') {
        action = 'reject'
        finalValue = target.current
      }
      const tokenErrors = compareProtectedTokens(target.source, finalValue, {
        lineBreaks: 'korean-dialogue',
        preserveLineBreakTokens: true,
      })
      if (tokenErrors.length) {
        action = 'reject'
        finalValue = target.current
      }
      if (action === 'accept') accepted++
      else if (action === 'replace') replaced++
      else rejected++
      fs.appendFileSync(output, `${JSON.stringify({
        novelId: target.novelId,
        source: target.source,
        current: target.current,
        candidate: target.candidate,
        action,
        final: finalValue,
        reason: decision.reason || '',
      })}\n`, 'utf8')
    }
    console.log(`accept=${accepted} replace=${replaced} reject=${rejected}`)
    if (offset + BATCH_SIZE < records.length && BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS)
  }
  console.log(`done total=${records.length} accept=${accepted} replace=${replaced} reject=${rejected}`)
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
