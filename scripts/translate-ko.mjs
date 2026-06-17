#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const TRANSLATIONS_DIR = path.join(ROOT, 'translations')
const MANIFEST_FILE = path.join(TRANSLATIONS_DIR, 'manifest', 'ko_KR.json')
const STATE_FILE = path.join(ROOT, '.translate-ko-state.json')
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const API_KEY = process.env.OPENAI_API_KEY
const BATCH_SIZE = Number(process.env.TRANSLATE_BATCH_SIZE || 40)
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 4)
const API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'

function parseArgs(argv) {
  const out = { scope: 'all', limit: null, file: null, force: false, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--scope') out.scope = argv[++i]
    else if (a.startsWith('--scope=')) out.scope = a.slice(8)
    else if (a === '--limit') out.limit = Number(argv[++i])
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice(8))
    else if (a === '--file') out.file = argv[++i]
    else if (a.startsWith('--file=')) out.file = a.slice(7)
    else if (a === '--force') out.force = true
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--help' || a === '-h') usage(0)
    else throw new Error(`Unknown argument: ${a}`)
  }
  return out
}

function usage(code = 0) {
  console.log(`Usage:
  npm run translate:ko -- --scope common
  npm run translate:ko -- --scope novels --limit 5
  npm run translate:ko -- --file translations/novels/hmn_10030100003/ko_KR.json
  npm run translate:ko -- --scope novels

Options:
  --scope common|novels|all   Translation target. common = names/titles/descriptions/another_name
  --limit N                   Limit novel files for test translation
  --file PATH                 Translate only one ko_KR.json file
  --force                     Translate all string values, even if they look Korean
  --dry-run                   Show target files/items without API calls

Env:
  OPENAI_API_KEY              Required unless --dry-run
  OPENAI_MODEL                Optional, default: ${MODEL}
  TRANSLATE_BATCH_SIZE        Optional, default: ${BATCH_SIZE}
  TRANSLATE_MAX_RETRIES       Optional, default: ${MAX_RETRIES}`)
  process.exit(code)
}

function toPosix(p) { return p.split(path.sep).join('/') }
function rel(p) { return toPosix(path.relative(ROOT, p)) }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex') }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 4) + '\n', 'utf8') }

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

function isManifest(file) { return path.resolve(file) === path.resolve(MANIFEST_FILE) }
function isKoJson(file) { return file.endsWith(`${path.sep}ko_KR.json`) || file.endsWith('/ko_KR.json') }

function getTargetFiles(args) {
  if (args.file) {
    const full = path.resolve(ROOT, args.file)
    if (!fs.existsSync(full)) throw new Error(`File not found: ${args.file}`)
    if (!isKoJson(full)) throw new Error(`Not a ko_KR.json file: ${args.file}`)
    if (isManifest(full)) throw new Error('translations/manifest/ko_KR.json is excluded from translation')
    return [full]
  }

  let files = []
  if (args.scope === 'common') {
    for (const d of ['names', 'titles', 'descriptions', 'another_name']) {
      const f = path.join(TRANSLATIONS_DIR, d, 'ko_KR.json')
      if (fs.existsSync(f)) files.push(f)
    }
  } else if (args.scope === 'novels') {
    files = walk(path.join(TRANSLATIONS_DIR, 'novels')).filter(isKoJson).sort()
    if (args.limit != null) files = files.slice(0, args.limit)
  } else if (args.scope === 'all') {
    files = walk(TRANSLATIONS_DIR).filter(isKoJson).filter(f => !isManifest(f)).sort()
  } else {
    throw new Error(`Invalid --scope: ${args.scope}`)
  }
  return files.filter(f => !isManifest(f))
}

const jpRe = /[\u3040-\u30ff\u3400-\u9fff]/
const koRe = /[\uac00-\ud7a3]/
function looksJapanese(s) { return jpRe.test(s) }
function looksNaturalKoreanEnough(s) { return koRe.test(s) && !/[\u3040-\u30ff]/.test(s) }
function shouldTranslate(value, force = false) {
  if (typeof value !== 'string') return false
  if (value.trim() === '') return false
  if (force) return true
  if (looksNaturalKoreanEnough(value)) return false
  return looksJapanese(value)
}

function extractTagTokens(s) {
  const patterns = [
    /<[^>]+>/g,                         // HTML, TMP, Unity rich text tags, <user>, <br>
    /%[A-Za-z0-9_]+%/g,                 // %user%
    /\{[A-Za-z0-9_]+\}/g,              // {name}
    /\$\{[^}]+\}/g,                    // ${name}
    /\\[nrt]/g                          // escaped control markers in literal text
  ]
  const tokens = []
  for (const re of patterns) {
    for (const m of s.matchAll(re)) tokens.push(m[0])
  }
  return tokens
}

function validateTokenPreservation(source, translated) {
  const src = extractTagTokens(source)
  const dst = extractTagTokens(translated)
  for (const token of src) {
    const a = src.filter(x => x === token).length
    const b = dst.filter(x => x === token).length
    if (a !== b) return `token count mismatch: ${token} source=${a} translated=${b}`
  }
  return null
}

function collectEntries(data, prefix = []) {
  const out = []
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out
  for (const [key, value] of Object.entries(data)) {
    const p = [...prefix, key]
    if (typeof value === 'string') out.push({ path: p, key, value })
    else if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...collectEntries(value, p))
  }
  return out
}

function setByPath(obj, p, value) {
  let cur = obj
  for (let i = 0; i < p.length - 1; i++) cur = cur[p[i]]
  cur[p[p.length - 1]] = value
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { done: {}, failed: {} }
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  catch { return { done: {}, failed: {} } }
}
function saveState(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8') }

function batchId(file, items) {
  return sha1(JSON.stringify({ file: rel(file), items: items.map(x => [x.path, x.value]) }))
}

function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

function buildMessages(items) {
  return [
    {
      role: 'system',
      content: [
        '당신은 일본어 게임 번역 전문 번역가입니다.',
        '일본어 게임 대사를 자연스러운 한국어로 번역한다.',
        'key는 절대 번역하지 않는다.',
        'value만 번역한다.',
        '<br>, <user>, %user%, HTML/TMP 태그는 그대로 유지한다.',
        'Unity Rich Text 태그(<size=48>, <color=#fff>, </size> 등)도 그대로 유지한다.',
        '특수기호, 줄바꿈 의미, 말줄임표, 따옴표의 의미를 보존한다.',
        '성인향/선정적 표현은 의미가 사라지지 않게 한국어 게임 번역처럼 자연스럽게 번역한다.',
        '출력은 JSON만 한다.',
        '항목 수를 유지한다.',
        '출력 스키마: {"items":[{"id":number,"value":string}]}',
        '입력 id는 반드시 그대로 반환한다.'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({ items: items.map((x, id) => ({ id, key: x.key, value: x.value })) }, null, 2)
    }
  ]
}

function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

async function callOpenAI(items) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: buildMessages(items)
    })
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${text.slice(0, 1000)}`)
  const data = JSON.parse(text)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI response has no message content')
  const parsed = JSON.parse(stripJsonFence(content))
  if (!Array.isArray(parsed.items)) throw new Error('OpenAI JSON does not contain items array')
  if (parsed.items.length !== items.length) throw new Error(`Item count mismatch: expected=${items.length} actual=${parsed.items.length}`)
  const byId = new Map(parsed.items.map(x => [Number(x.id), x.value]))
  return items.map((item, id) => {
    const value = byId.get(id)
    if (typeof value !== 'string') throw new Error(`Missing or non-string translated value for id=${id}`)
    const tokenError = validateTokenPreservation(item.value, value)
    if (tokenError) throw new Error(`Token preservation failed at id=${id}: ${tokenError}\nsource=${item.value}\ntranslated=${value}`)
    return value
  })
}

async function translateBatchWithRetry(items) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try { return await callOpenAI(items) }
    catch (err) {
      lastErr = err
      const delay = Math.min(30000, 1000 * 2 ** (attempt - 1))
      console.warn(`  retry ${attempt}/${MAX_RETRIES} failed: ${err.message.split('\n')[0]}`)
      if (attempt < MAX_RETRIES) await sleep(delay)
    }
  }
  throw lastErr
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const files = getTargetFiles(args)
  console.log(`model=${MODEL}`)
  console.log(`target_files=${files.length}`)
  if (!args.dryRun && !API_KEY) throw new Error('OPENAI_API_KEY environment variable is required')

  const state = loadState()
  let totalCandidates = 0, totalTranslated = 0, totalSkippedBatches = 0, totalFailed = 0

  for (const file of files) {
    const data = readJson(file)
    const entries = collectEntries(data).filter(x => shouldTranslate(x.value, args.force))
    totalCandidates += entries.length
    console.log(`\n[${rel(file)}] candidates=${entries.length}`)
    if (args.dryRun || entries.length === 0) continue

    const batches = chunk(entries, BATCH_SIZE)
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const id = batchId(file, batch)
      if (state.done[id]) {
        totalSkippedBatches++
        continue
      }
      process.stdout.write(`  batch ${i + 1}/${batches.length} items=${batch.length} ... `)
      try {
        const translatedValues = await translateBatchWithRetry(batch)
        translatedValues.forEach((v, idx) => setByPath(data, batch[idx].path, v))
        writeJson(file, data)
        state.done[id] = { file: rel(file), count: batch.length, at: new Date().toISOString() }
        delete state.failed[id]
        saveState(state)
        totalTranslated += batch.length
        console.log('ok')
      } catch (err) {
        totalFailed++
        state.failed[id] = { file: rel(file), count: batch.length, at: new Date().toISOString(), error: err.message }
        saveState(state)
        console.log('failed')
        console.error(err.message)
      }
    }
  }

  console.log(`\nsummary candidates=${totalCandidates} translated=${totalTranslated} skipped_batches=${totalSkippedBatches} failed_batches=${totalFailed}`)
  if (!args.dryRun) {
    console.log('regenerating manifest...')
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/update-manifest.mjs')], { stdio: 'inherit', cwd: ROOT })
    if (r.status !== 0) process.exitCode = r.status || 1
  }
  if (totalFailed > 0) process.exitCode = 1
}

main().catch(err => {
  console.error(err.stack || err.message)
  process.exit(1)
})
