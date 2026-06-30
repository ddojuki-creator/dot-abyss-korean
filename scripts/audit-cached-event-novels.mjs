#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT, readJson, walk } from './lib/ko-pipeline.mjs'

const japanese = /[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function defaultCacheRoot() {
  const game = process.env.DOTABYSS_GAME_DIR || 'F:\\DMMGamePlayer\\dotabyss_x_cl'
  const dataDir = path.join(game, 'ドットアビスX_Data', 'Caches')
  if (fs.existsSync(dataDir)) return dataDir
  const localLow = path.resolve(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), '..', 'LocalLow')
  return path.join(localLow, 'EXNOA LLC_', 'ドットアビスX')
}

function extractMessages(script) {
  const messages = []
  for (const line of script.split(/\r?\n/)) {
    if (!line.startsWith('message,')) continue
    let rest = line.slice('message,'.length)
    const firstComma = rest.indexOf(',')
    if (firstComma < 0) continue
    rest = rest.slice(firstComma + 1)
    const marker = rest.match(/,(?:\d{6,}|[A-Z]?\d{6,}[A-Z]?)(?:,,[^,]+)?$/)
    const message = marker ? rest.slice(0, marker.index) : rest
    if (message) messages.push(message)
  }
  return messages
}

function scanCachedBundleNames(cacheRoot) {
  const bundles = new Map()
  if (!fs.existsSync(cacheRoot)) return bundles

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

    const nameMatches = [...header.matchAll(/evs_\d{11}/g)]
    if (!nameMatches.length) continue

    for (const match of nameMatches) {
      const name = match[0]
      if (!name.startsWith('evs_')) continue
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
            novel_ids = sorted(set(re.findall(r"evs_\d{11}", str(name) + "\n" + text)))
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

function scanUnityTextAssets(cacheRoot, candidateFiles) {
  if (!fs.existsSync(cacheRoot) || !candidateFiles.length) return { scripts: new Map(), scanner: 'skipped' }

  const commands = []
  const candidateArg = (temp) => {
    if (process.env.PYTHON) commands.push([process.env.PYTHON, '-c', unityPyScanner, cacheRoot, temp])
    commands.push(['python', '-c', unityPyScanner, cacheRoot, temp])
    commands.push(['py', '-3', '-c', unityPyScanner, cacheRoot, temp])
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
const cachedBundles = scanCachedBundleNames(cacheRoot)
const candidateFiles = [...new Set([...cachedBundles.values()].map((info) => info.file))]
const unity = scanUnityTextAssets(cacheRoot, candidateFiles)
const scripts = mergeScripts(unity.scripts)
const issues = []
let checked = 0

for (const [novelId, info] of [...scripts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  checked++
  const target = path.join(ROOT, 'translations', 'novels', novelId, 'ko_KR.json')
  if (!fs.existsSync(target)) {
    issues.push({ type: 'missing-file', novelId, file: info.file, count: info.messages.length })
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
}

console.log(`audit:cached-event-novels cacheRoot=${cacheRoot}`)
console.log(`audit:cached-event-novels scanner=${unity.scanner} bundles=${cachedBundles.size} files=${candidateFiles.length} unity=${unity.scripts.size}`)
console.log(`audit:cached-event-novels checked=${checked} issues=${issues.length}`)
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
