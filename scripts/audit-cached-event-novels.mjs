#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT, readJson, walk, writeJson } from './lib/ko-pipeline.mjs'

const japanese = /[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/
const novelIdPattern = String.raw`(?:evs|hmr|hmn|men)_\d{11}`
const novelIdRe = new RegExp(novelIdPattern, 'g')

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function defaultCacheRoot() {
  const game = defaultGameDir()
  const dataDir = path.join(game, 'ドットアビスX_Data', 'Caches')
  if (fs.existsSync(dataDir)) return dataDir
  const localLow = path.resolve(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), '..', 'LocalLow')
  return path.join(localLow, 'EXNOA LLC_', 'ドットアビスX')
}

function defaultGameDir() {
  return process.env.DOTABYSS_GAME_DIR || 'F:\\DMMGamePlayer\\dotabyss_x_cl'
}

function defaultLogFile() {
  return path.join(defaultGameDir(), 'BepInEx', 'LogOutput.log')
}

function scanLogNovelIds(logFile) {
  const novelIds = new Set()
  if (!fs.existsSync(logFile)) return novelIds

  let text
  try {
    text = fs.readFileSync(logFile, 'utf8')
  } catch {
    return novelIds
  }

  for (const match of text.matchAll(new RegExp(`NovelId:\\s*(${novelIdPattern})`, 'g'))) novelIds.add(match[1])
  for (const match of text.matchAll(new RegExp(`translations\\/novels\\/(${novelIdPattern})\\/ko_KR\\.json`, 'g'))) novelIds.add(match[1])
  return novelIds
}

function stripMessageMeta(text) {
  let message = text
  for (;;) {
    const before = message
    message = message
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),vc_[^,]*(?:,(?:\d+\/)?chara_\d+)?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),vc_[^,]*(?:,(?:on|off|(?:\d+\/)?chara_\d+(?:\/chara_\d+)*))?[,]?$/, '')
      .replace(/,,vc_[^,]*(?:,(?:on|off|(?:\d+\/)?chara_\d+(?:\/chara_\d+)*))?[,]?$/, '')
      .replace(/,{2,3}(?:\d+\/)?chara_\d+(?:\/chara_\d+)*$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?)(?:,,[^,]+)?$/, '')
    if (message === before) return message
  }
}

function extractMessages(script) {
  const messages = []
  for (const line of script.split(/\r?\n/)) {
    if (!line.startsWith('message,')) continue
    let rest = line.slice('message,'.length)
    const firstComma = rest.indexOf(',')
    if (firstComma < 0) continue
    rest = rest.slice(firstComma + 1)
    const message = stripMessageMeta(rest)
    if (message) messages.push(message)
  }
  return messages
}

function scanCachedBundleNames(cacheRoot, options = {}) {
  const bundles = new Map()
  if (!fs.existsSync(cacheRoot)) return bundles
  const cachedNovelIdRe = options.allCached ? novelIdRe : /evs_\d{11}/g

  for (const file of walk(cacheRoot)) {
    if (path.basename(file) !== '__data') continue
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

    const nameMatches = [...header.matchAll(cachedNovelIdRe)]
    if (!nameMatches.length) continue

    for (const match of nameMatches) {
      const name = match[0]
      bundles.set(name, { file })
    }
  }
  return bundles
}

const unityPyScanner = String.raw`
import json
import os
import re
import sys

cache_root = sys.argv[1]
candidate_file = sys.argv[2] if len(sys.argv) > 2 else None
target_ids = set(json.loads(sys.argv[3])) if len(sys.argv) > 3 and sys.argv[3] else set()
found = []

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    import UnityPy
except Exception as exc:
    print(json.dumps({"error": "UnityPy unavailable: " + str(exc)}, ensure_ascii=False))
    sys.exit(3)

if candidate_file:
    with open(candidate_file, "r", encoding="utf-8") as handle:
        files_to_scan = json.load(handle)
else:
    files_to_scan = []
    for root, _, files in os.walk(cache_root):
        if "__data" in files:
            files_to_scan.append(os.path.join(root, "__data"))

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
            if "message," not in text:
                continue
            novel_ids = sorted(set(re.findall(r"(?:evs|hmr|hmn|men)_\d{11}", str(name) + "\n" + text)))
            if target_ids and not (target_ids & set(novel_ids)):
                continue
            for novel_id in novel_ids:
                found.append({"id": novel_id, "file": file, "script": text})
        except Exception:
            continue

print(json.dumps({"found": found}, ensure_ascii=False))
`

function runPython(args) {
  return spawnSync(args[0], args.slice(1), {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  })
}

function withTempJson(data, callback) {
  const temp = path.join(os.tmpdir(), `dotabyss-cached-event-novels-${process.pid}-${Date.now()}.json`)
  fs.writeFileSync(temp, JSON.stringify(data), 'utf8')
  try {
    return callback(temp)
  } finally {
    try {
      fs.unlinkSync(temp)
    } catch {}
  }
}

function listSmallCacheDataFiles(cacheRoot) {
  const files = []
  if (!fs.existsSync(cacheRoot)) return files

  for (const file of walk(cacheRoot)) {
    if (path.basename(file) !== '__data') continue
    try {
      const size = fs.statSync(file).size
      if (size >= 1000 && size <= 250000) files.push(file)
    } catch {}
  }
  return files
}

function scanUnityTextAssets(cacheRoot, candidateFiles, options = {}) {
  if (!fs.existsSync(cacheRoot) || !candidateFiles.length) return { scripts: new Map(), scanner: 'skipped' }
  const targetArg = options.targetIds?.size ? JSON.stringify([...options.targetIds]) : ''

  const commands = []
  const candidateArg = (temp) => {
    if (process.env.PYTHON) commands.push([process.env.PYTHON, '-c', unityPyScanner, cacheRoot, temp, targetArg])
    commands.push(['python', '-c', unityPyScanner, cacheRoot, temp, targetArg])
    commands.push(['py', '-3', '-c', unityPyScanner, cacheRoot, temp, targetArg])
  }

  return withTempJson(candidateFiles, (temp) => {
    candidateArg(temp)

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

        const scripts = new Map()
        for (const item of payload.found || []) {
          const messages = extractMessages(item.script || '').filter((message) => japanese.test(message))
          if (messages.length) {
            scripts.set(item.id, {
              file: item.file,
              messages: [...new Set(messages)],
            })
          }
        }
        return { scripts, scanner: command[0] }
      } catch (error) {
        lastError = error.message
      }
    }

    return { scripts: new Map(), scanner: `unavailable (${lastError || 'unknown error'})` }
  })
}

function mergeScripts(...maps) {
  const merged = new Map()
  for (const scripts of maps) {
    for (const [novelId, info] of scripts) {
      if (!merged.has(novelId)) {
        merged.set(novelId, { file: info.file, messages: [...info.messages] })
        continue
      }
      const current = merged.get(novelId)
      current.messages = [...new Set([...current.messages, ...info.messages])]
    }
  }
  return merged
}

const cacheRoot = option('--cache-root') || defaultCacheRoot()
const logFile = option('--log-file') || defaultLogFile()
const allCached = hasFlag('--all-cached')
const writeMissingSource = hasFlag('--write-missing-source')
const cachedBundles = scanCachedBundleNames(cacheRoot, { allCached })
const candidateFiles = [...new Set([...cachedBundles.values()].map((info) => info.file))]
const logNovelIds = scanLogNovelIds(logFile)
const unity = scanUnityTextAssets(cacheRoot, candidateFiles)
let scripts = mergeScripts(unity.scripts)
let fallback = { scripts: new Map(), scanner: 'skipped', files: 0 }

const missingLogIds = [...logNovelIds].filter((novelId) => !scripts.has(novelId))
if (allCached && missingLogIds.length) {
  const smallFiles = listSmallCacheDataFiles(cacheRoot)
  fallback = {
    ...scanUnityTextAssets(cacheRoot, smallFiles, { targetIds: new Set(missingLogIds) }),
    files: smallFiles.length,
  }
  scripts = mergeScripts(scripts, fallback.scripts)
}

const issues = []
const warnings = []
let checked = 0

const novelIds = [...new Set([...scripts.keys(), ...logNovelIds])].sort()

for (const novelId of novelIds) {
  const info = scripts.get(novelId) || { file: logFile, messages: [] }
  checked++
  const target = path.join(ROOT, 'translations', 'novels', novelId, 'ko_KR.json')
  if (!fs.existsSync(target)) {
    const issue = { type: 'missing-file', novelId, file: info.file, count: info.messages.length, messages: info.messages }
    if (info.messages.length) issues.push(issue)
    else warnings.push({ ...issue, type: 'log-only-missing-file' })
    continue
  }

  const translations = readJson(target)
  for (const source of info.messages) {
    const value = translations[source]
    if (typeof value !== 'string') {
      issues.push({ type: 'missing-key', novelId, source })
    } else if (value === source || japanese.test(value)) {
      issues.push({ type: 'untranslated', novelId, source, value })
    }
  }

  if (!info.messages.length) {
    const translations = readJson(target)
    for (const [source, value] of Object.entries(translations)) {
      if (typeof value === 'string' && (value === source || japanese.test(value))) {
        issues.push({ type: 'untranslated', novelId, source, value })
      }
    }
  }
}

console.log(`audit:cached-event-novels cacheRoot=${cacheRoot}`)
console.log(`audit:cached-event-novels logFile=${logFile}`)
console.log(`audit:cached-event-novels scanner=${unity.scanner} allCached=${allCached} bundles=${cachedBundles.size} files=${candidateFiles.length} unity=${unity.scripts.size} logIds=${logNovelIds.size}`)
if (fallback.scanner !== 'skipped') {
  console.log(`audit:cached-event-novels fallbackScanner=${fallback.scanner} fallbackFiles=${fallback.files} fallbackUnity=${fallback.scripts.size} missingLogIds=${missingLogIds.length}`)
}
console.log(`audit:cached-event-novels checked=${checked} issues=${issues.length} warnings=${warnings.length}`)
if (writeMissingSource) {
  let written = 0
  for (const issue of issues) {
    if (issue.type !== 'missing-file' || !issue.messages.length) continue
    const target = path.join(ROOT, 'translations', 'novels', issue.novelId, 'ko_KR.json')
    if (fs.existsSync(target)) continue
    const data = Object.fromEntries(issue.messages.map((message) => [message, message]))
    writeJson(target, data)
    written++
  }
  console.log(`audit:cached-event-novels wroteMissingSource=${written}`)
}
for (const warning of warnings.slice(0, 20)) {
  console.log(`\n[warning:${warning.type}] ${warning.novelId} messages=${warning.count}`)
  console.log(`cache: ${warning.file}`)
}
for (const issue of issues.slice(0, 40)) {
  if (issue.type === 'missing-file') {
    console.log(`\n[missing-file] ${issue.novelId} messages=${issue.count}`)
    console.log(`cache: ${issue.file}`)
  } else {
    console.log(`\n[${issue.type}] translations/novels/${issue.novelId}/ko_KR.json`)
    console.log(`source: ${JSON.stringify(issue.source)}`)
    if (issue.value) console.log(`value : ${JSON.stringify(issue.value)}`)
  }
}

if (issues.length) process.exitCode = 1
