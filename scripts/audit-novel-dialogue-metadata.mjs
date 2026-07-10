#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CACHE_DIR, ROOT, readJson, walk, writeJson } from './lib/ko-pipeline.mjs'

const japanese = /[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/
const novelIdPattern = String.raw`(?:mas_\d{10}|(?:evs|hmr|hmn|men)_\d{11})`
const novelIdRe = new RegExp(novelIdPattern, 'g')
const sumataSourceRe = /素股|スマタ|すまた/
const dannaSourceRe = /旦那(?:様|さま)?/

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function parseSince(value) {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid --cache-since value: ${value}`)
  return timestamp
}

function defaultGameDir() {
  return process.env.DOTABYSS_GAME_DIR || 'F:\\DMMGamePlayer\\dotabyss_x_cl'
}

function defaultCacheRoot() {
  const game = defaultGameDir()
  const dataDir = path.join(game, 'ドットアビスX_Data', 'Caches')
  if (fs.existsSync(dataDir)) return dataDir
  const localLow = path.resolve(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), '..', 'LocalLow')
  return path.join(localLow, 'EXNOA LLC_', 'ドットアビスX')
}

function stripMessageMeta(text) {
  let message = text
  for (;;) {
    const before = message
    message = message
      .replace(/,{2,}$/, '')
      .replace(/,{2,3}(?:on|off|ALLON)$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),(?:vc|mcv)_[^,]*(?:,(?:\d+\/)?chara_\d+)?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),(?:vc|mcv)_[^,]*(?:,(?:on|off|ALLON|(?:\d+\/)?chara_\d+(?:\/chara_\d+)*))?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?)(?:,,[^,]+)?$/, '')
      .replace(/,,(?:vc|mcv)_[^,]*(?:,(?:on|off|ALLON|(?:\d+\/)?chara_\d+(?:\/chara_\d+)*))?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),(?:vc|mcv)_[^,\r\n]*(?:,[^\r\n]*)?$/, '')
      .replace(/,,(?:vc|mcv)_[^,\r\n]*(?:,[^\r\n]*)?$/, '')
      .replace(/,{2,3}(?:\d+\/)?chara_\d+(?:\/chara_\d+)*$/, '')
    if (message === before) return message
  }
}

function parseMessageLine(line, lineNumber) {
  const command = line.startsWith('message,')
    ? 'message'
    : line.startsWith('messageTextCenter,')
      ? 'messageTextCenter'
      : line.startsWith('l2dmessage,')
        ? 'l2dmessage'
        : null
  if (!command) return null

  const rest = line.slice(`${command},`.length)
  const firstComma = rest.indexOf(',')
  if (firstComma < 0) return null
  const speaker = rest.slice(0, firstComma)
  const payload = rest.slice(firstComma + 1)
  const message = stripMessageMeta(payload)
  if (!message) return null

  const voice = payload.match(/(?:vc|mcv)_[^,]*/)?.[0] || null
  const chara = payload.match(/(?:\d+\/)?chara_\d+(?:\/chara_\d+)*/)?.[0] || null
  return { line: lineNumber, command, speaker, source: message, voice, chara }
}

function extractMessageRecords(script, novelId, cacheFile) {
  const records = []
  const lines = String(script || '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseMessageLine(lines[i], i + 1)
    if (!parsed) continue
    records.push({ novelId, cacheFile, ...parsed })
  }
  return records
}

function scanCachedBundleNames(cacheRoot, options = {}) {
  const bundles = new Map()
  if (!fs.existsSync(cacheRoot)) return bundles
  const cachedNovelIdRe = options.allCached ? novelIdRe : /evs_\d{11}/g

  for (const file of walk(cacheRoot)) {
    if (path.basename(file) !== '__data') continue
    if (options.since != null) {
      try {
        if (fs.statSync(file).mtimeMs < options.since) continue
      } catch {
        continue
      }
    }
    let header
    try {
      const fd = fs.openSync(file, 'r')
      const buffer = Buffer.alloc(Math.min(fs.statSync(file).size, 128 * 1024))
      fs.readSync(fd, buffer, 0, buffer.length, 0)
      fs.closeSync(fd)
      header = buffer.toString('utf8')
    } catch {
      continue
    }

    for (const match of header.matchAll(cachedNovelIdRe)) bundles.set(match[0], { file })
  }
  return bundles
}

function listSmallCacheDataFiles(cacheRoot, since = null) {
  const files = []
  if (!fs.existsSync(cacheRoot)) return files
  for (const file of walk(cacheRoot)) {
    if (path.basename(file) !== '__data') continue
    try {
      const stat = fs.statSync(file)
      if (since != null && stat.mtimeMs < since) continue
      const size = stat.size
      if (size >= 1000 && size <= 250000) files.push(file)
    } catch {}
  }
  return files
}

const unityPyScanner = String.raw`
import json
import os
import re
import sys

cache_root = sys.argv[1]
candidate_file = sys.argv[2]
found = []

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import UnityPy
except Exception as exc:
    print(json.dumps({"error": "UnityPy unavailable: " + str(exc)}, ensure_ascii=False))
    sys.exit(3)

with open(candidate_file, "r", encoding="utf-8") as handle:
    files_to_scan = json.load(handle)

for file in files_to_scan:
    try:
        env = UnityPy.load(file)
    except Exception:
        continue
    for obj in env.objects:
        try:
            if obj.type.name != "TextAsset":
                continue
            data = obj.read()
            name = getattr(data, "name", None) or getattr(data, "m_Name", None) or ""
            script = getattr(data, "script", None)
            if script is None:
                script = getattr(data, "m_Script", None)
            if isinstance(script, bytes):
                text = script.decode("utf-8", "ignore")
            else:
                text = str(script or "")
            if "message," not in text and "messageTextCenter," not in text and "l2dmessage," not in text:
                continue
            novel_ids = sorted(set(re.findall(r"(?:mas_\d{10}|(?:evs|hmr|hmn|men)_\d{11})", str(name) + "\n" + text)))
            for novel_id in novel_ids:
                found.append({"id": novel_id, "file": file, "script": text})
        except Exception:
            continue

print(json.dumps({"found": found}, ensure_ascii=False))
`

function withTempJson(data, callback) {
  const temp = path.join(os.tmpdir(), `dotabyss-novel-dialogue-${process.pid}-${Date.now()}.json`)
  fs.writeFileSync(temp, JSON.stringify(data), 'utf8')
  try {
    return callback(temp)
  } finally {
    try {
      fs.unlinkSync(temp)
    } catch {}
  }
}

function runPython(args) {
  return spawnSync(args[0], args.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    shell: false,
  })
}

function scanUnityTextAssets(cacheRoot, candidateFiles) {
  if (!fs.existsSync(cacheRoot) || !candidateFiles.length) return { records: [], scanner: 'skipped' }
  return withTempJson(candidateFiles, (temp) => {
    const commands = []
    if (process.env.PYTHON) commands.push([process.env.PYTHON, '-c', unityPyScanner, cacheRoot, temp])
    commands.push(['python', '-c', unityPyScanner, cacheRoot, temp])
    commands.push(['py', '-3', '-c', unityPyScanner, cacheRoot, temp])

    let lastError = null
    for (const command of commands) {
      const result = runPython(command)
      if (result.error) {
        lastError = result.error.message
        continue
      }
      if (result.status !== 0) {
        lastError = (result.stderr || result.stdout || `exit ${result.status}`).trim()
        continue
      }

      try {
        const payload = JSON.parse(result.stdout)
        if (payload.error) {
          lastError = payload.error
          continue
        }
        const records = []
        for (const item of payload.found || []) {
          records.push(...extractMessageRecords(item.script, item.id, item.file))
        }
        return { records, scanner: command[0] }
      } catch (error) {
        lastError = error.message
      }
    }
    return { records: [], scanner: `unavailable (${lastError || 'unknown error'})` }
  })
}

function hasJapaneseOutsideTags(value) {
  return japanese.test(String(value).replace(/<[^>]*>/g, ''))
}

function normalizeKurehaDanna(value) {
  return value
    .replace(/나리님/g, '서방님')
    .replace(/나리께서/g, '서방님께서')
    .replace(/나리께/g, '서방님께')
    .replace(/나리에게/g, '서방님께')
    .replace(/나리와/g, '서방님과')
    .replace(/나리의/g, '서방님의')
    .replace(/나리를/g, '서방님을')
    .replace(/주인님/g, '서방님')
    .replace(/나리/g, '서방님')
    .replace(/서방님가/g, '서방님이')
}

function normalizeMarinaDanna(value) {
  return value
    .replace(/서방님/g, '나리')
    .replace(/주인님/g, '나리')
    .replace(/남편님|남편|여보|사장님/g, '나리')
}

function normalizeSumata(value, source) {
  let result = value
    .replace(/스오마타|스오마|소마타|스타마/g, '스마타')
    .replace(/스마타\([^)]*\)/g, '스마타')
    .replace(/겉치기만으로도/g, '스마타만으로도')
    .replace(/겉치기만/g, '스마타만')
    .replace(/그냥\s*겉으로만 하는 코스/g, '스마타까지의 코스')
    .replace(/겉으로만 하는 코스/g, '스마타까지의 코스')
  if (source === 'まずは素股からでいい？') result = '먼저 스마타부터 할까?'
  return result
}

function isKurehaDannaRecord(record) {
  return record.speaker === 'クレハ' && dannaSourceRe.test(record.source)
}

function isMarinaDannaRecord(record) {
  return record.speaker === 'マリナ' && dannaSourceRe.test(record.source)
}

function isSumataRecord(record) {
  return sumataSourceRe.test(record.source)
}

function dedupeRecords(records) {
  const seen = new Set()
  const out = []
  for (const record of records) {
    const key = [
      record.novelId,
      record.command,
      record.speaker,
      record.source,
      record.voice || '',
      record.chara || '',
      record.line,
    ].join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(record)
  }
  return out.sort((a, b) => a.novelId.localeCompare(b.novelId) || a.line - b.line || a.source.localeCompare(b.source))
}

const cacheRoot = option('--cache-root') || defaultCacheRoot()
const allCached = hasFlag('--all-cached')
const deepSmallTextAssets = hasFlag('--deep-small-textassets')
const cacheSince = parseSince(option('--cache-since'))
const fix = hasFlag('--fix')
const writeMissingSource = hasFlag('--write-missing-source')
const writeIndex = hasFlag('--write-index') || fix
const indexFile = option('--index-file') || path.join(CACHE_DIR, 'novel-message-index.json')

const cachedBundles = scanCachedBundleNames(cacheRoot, { allCached, since: cacheSince })
const candidateFiles = [...new Set([...cachedBundles.values()].map((info) => info.file))]
const unity = scanUnityTextAssets(cacheRoot, candidateFiles)
let records = unity.records
let fallback = { records: [], scanner: 'skipped', files: 0 }
if (allCached && deepSmallTextAssets) {
  const smallFiles = listSmallCacheDataFiles(cacheRoot, cacheSince)
  fallback = { ...scanUnityTextAssets(cacheRoot, smallFiles), files: smallFiles.length }
  records = [...records, ...fallback.records]
}
records = dedupeRecords(records)

if (writeIndex) writeJson(indexFile, records)

const grouped = new Map()
for (const record of records) {
  if (!grouped.has(record.novelId)) grouped.set(record.novelId, [])
  grouped.get(record.novelId).push(record)
}

const issues = []
const warnings = []
const fixes = []

for (const [novelId, novelRecords] of grouped) {
  const file = path.join(ROOT, 'translations', 'novels', novelId, 'ko_KR.json')
  if (!fs.existsSync(file) && !writeMissingSource) {
    issues.push({ type: 'missing-file', novelId, count: novelRecords.length })
    continue
  }
  const data = fs.existsSync(file) ? readJson(file) : {}
  let changed = false

  for (const record of novelRecords) {
    const source = record.source
    if (!japanese.test(source)) continue
    let value = data[source]
    if (typeof value !== 'string') {
      if (writeMissingSource) {
        data[source] = source
        value = source
        changed = true
      } else {
        issues.push({ type: 'missing-key', novelId, source, speaker: record.speaker, command: record.command })
        continue
      }
    }

    if (fix) {
      let next = value
      if (isKurehaDannaRecord(record)) next = normalizeKurehaDanna(next)
      if (isMarinaDannaRecord(record)) next = normalizeMarinaDanna(next)
      if (isSumataRecord(record)) next = normalizeSumata(next, source)
      if (next !== value) {
        const before = value
        data[source] = next
        value = next
        changed = true
        fixes.push({ novelId, source, before, after: next })
      }
    }

    if (value === source || hasJapaneseOutsideTags(value)) {
      issues.push({ type: 'untranslated', novelId, source, value, speaker: record.speaker, command: record.command })
    }
    if (isKurehaDannaRecord(record)) {
      if (!value.includes('서방님') || /(나리|주인님|단나|남편|여보|사장님|서방님가)/.test(value)) {
        issues.push({ type: 'kureha-danna', novelId, source, value, speaker: record.speaker })
      }
    }
    if (isMarinaDannaRecord(record)) {
      if (!value.includes('나리') || /(서방님|주인님|단나|남편|여보|사장님)/.test(value)) {
        issues.push({ type: 'marina-danna', novelId, source, value, speaker: record.speaker })
      }
    }
    if (isSumataRecord(record)) {
      if (!value.includes('스마타') || /(스오마|소마타|스타마|겉치기|겉으로만)/.test(value)) {
        issues.push({ type: 'sumata-term', novelId, source, value, speaker: record.speaker })
      }
    }
  }

  if (changed) writeJson(file, data)
}

const sourceSpeakers = new Map()
for (const record of records) {
  if (!japanese.test(record.source)) continue
  const key = record.source
  if (!sourceSpeakers.has(key)) sourceSpeakers.set(key, new Set())
  if (record.speaker) sourceSpeakers.get(key).add(record.speaker)
}
for (const [source, speakers] of sourceSpeakers) {
  if (speakers.size > 1 && (dannaSourceRe.test(source) || sumataSourceRe.test(source))) {
    warnings.push({ type: 'multi-speaker-source', source, speakers: [...speakers].sort() })
  }
}

console.log(`audit:novel-dialogue-metadata cacheRoot=${cacheRoot}`)
if (cacheSince != null) console.log(`audit:novel-dialogue-metadata cacheSince=${new Date(cacheSince).toISOString()}`)
console.log(`audit:novel-dialogue-metadata scanner=${unity.scanner} allCached=${allCached} bundles=${cachedBundles.size} files=${candidateFiles.length} records=${records.length}`)
if (fallback.scanner !== 'skipped') {
  console.log(`audit:novel-dialogue-metadata fallbackScanner=${fallback.scanner} fallbackFiles=${fallback.files} fallbackRecords=${fallback.records.length}`)
}
if (writeIndex) console.log(`audit:novel-dialogue-metadata index=${indexFile}`)
console.log(`audit:novel-dialogue-metadata novelIds=${grouped.size} fixes=${fixes.length} issues=${issues.length} warnings=${warnings.length}`)

for (const fixed of fixes.slice(0, 20)) {
  console.log(`\n[fixed] translations/novels/${fixed.novelId}/ko_KR.json`)
  console.log(`source: ${JSON.stringify(fixed.source)}`)
}
for (const warning of warnings.slice(0, 20)) {
  console.log(`\n[warning:${warning.type}]`)
  console.log(`source: ${JSON.stringify(warning.source)}`)
  if (warning.speakers) console.log(`speakers: ${warning.speakers.join(', ')}`)
}
for (const issue of issues.slice(0, 60)) {
  console.log(`\n[${issue.type}] translations/novels/${issue.novelId}/ko_KR.json`)
  if (issue.speaker) console.log(`speaker: ${issue.speaker}`)
  if (issue.command) console.log(`command: ${issue.command}`)
  if (issue.source) console.log(`source : ${JSON.stringify(issue.source)}`)
  if (issue.value) console.log(`value  : ${JSON.stringify(issue.value)}`)
}

if (issues.length) process.exitCode = 1
