#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const args = process.argv.slice(2)
let file, report, keysFile, fix = false, fail = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') file = args[++i]
  else if (args[i] === '--keys') keysFile = args[++i]
  else if (args[i] === '--report') report = args[++i]
  else if (args[i] === '--fix') fix = true
  else if (args[i] === '--fail') fail = true
  else throw new Error(`Unknown argument: ${args[i]}`)
}
const files = []
const selectedKeys = keysFile ? new Set(JSON.parse(fs.readFileSync(keysFile, 'utf8'))) : null
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(name)
    else if (entry.name === 'ko_KR.json') files.push(name)
  }
}
if (file) files.push(file)
else walk('translations/novels')
const hash = text => crypto.createHash('sha256').update(text).digest('hex')
// Only visible punctuation is eligible. Tags, variables and URLs stay opaque.
const opaque = /<[^>]*>|\{[^}]*\}|\[[^\]]*\]|https?:\/\/\S+|%[^%\s]+%/g
const dots = /\.{3,}|\.[ \t]+\.[ \t]+\.(?:[ \t]+\.)*/g
function normalize(value) {
  return value.split(opaque).map((part) => part.replace(dots, run => {
    const count = run.replace(/[ \t]/g, '').length
    // One conventional pause (three or six periods) uses the approved pair.
    // Keep longer repeated pauses and any trailing ordinary period.
    return '……'.repeat(Math.ceil(Math.floor(count / 3) / 2)) + '.'.repeat(count % 3)
  }))
}
// Preserve the protected spans when rebuilding; split alone would drop them.
function replacement(value) {
  let end = 0, result = ''
  for (const match of value.matchAll(opaque)) {
    result += normalize(value.slice(end, match.index)).join('') + match[0]
    end = match.index + match[0].length
  }
  return result + normalize(value.slice(end)).join('')
}
const result = { mode: fix ? 'fix' : 'audit', files: files.length, affectedFiles: 0, affectedValues: 0, records: [] }
for (const name of files.sort()) {
  const bytes = fs.readFileSync(name, 'utf8')
  const data = JSON.parse(bytes.replace(/^\uFEFF/, ''))
  const changes = []
  for (const [key, value] of Object.entries(data)) {
    if (selectedKeys && !selectedKeys.has(key)) continue
    if (typeof value !== 'string') continue
    const next = replacement(value)
    if (next !== value) changes.push({ key, before: value, after: next })
  }
  if (!changes.length) continue
  result.affectedFiles++
  result.affectedValues += changes.length
  // Replace only serialized value tokens; preserve formatting and source keys.
  let nextBytes = bytes
  if (fix) {
    const changeMap = new Map(changes.map(c => [c.key, c.after]))
    nextBytes = bytes.replace(/("(?:\\.|[^"\\])*"\s*:\s*)("(?:\\.|[^"\\])*")/g, (all, prefix, token) => {
      const key = JSON.parse(prefix.slice(0, prefix.lastIndexOf(':')).trim())
      return changeMap.has(key) ? prefix + JSON.stringify(changeMap.get(key)) : all
    })
    const saved = JSON.parse(nextBytes.replace(/^\uFEFF/, ''))
    if (JSON.stringify(Object.keys(saved)) !== JSON.stringify(Object.keys(data))) throw new Error(`Key change: ${name}`)
    for (const [key, value] of Object.entries(data)) {
      if (saved[key] !== (changeMap.get(key) ?? value)) throw new Error(`Unexpected value: ${name}`)
    }
    fs.writeFileSync(name, nextBytes, 'utf8')
  }
  result.records.push({ file: name.replaceAll('\\', '/'), beforeHash: hash(bytes), afterHash: hash(nextBytes), changes })
}
if (report) {
  fs.mkdirSync(path.dirname(report), { recursive: true })
  fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n')
}
console.log(JSON.stringify({ ...result, records: undefined }))
if (fail && result.affectedValues > 0 && !fix) process.exitCode = 1
