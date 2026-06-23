#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { collectEntries, parseArgs, rel, ROOT, setByPath, walk, writeJson } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))
const TARGET = 35
const HARD_LIMIT = 37
const REPORT_FILE = path.join(ROOT, '.cache', 'novel-layout-review.json')

function visibleLength(value) {
  return [...value.replace(/<[^>]+>/g, '')].length
}

function splitRenderedLines(value) {
  return String(value)
    .split(/<br\s*\/?\s*>|\\n|\r?\n/gi)
    .map((line) => line.trim())
    .filter(Boolean)
}

function flattenForDialogue(value) {
  return String(value)
    .replace(/<br\s*\/?\s*>|\\n|\r?\n/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordWrapTwoLines(value) {
  const compact = flattenForDialogue(value)
  if (!compact) return { lines: [], fits: true, longWord: false, value: compact }

  const words = compact.split(' ')
  const lines = []
  let current = ''
  let longWord = false

  for (const word of words) {
    if (visibleLength(word) > HARD_LIMIT) longWord = true
    const next = current ? `${current} ${word}` : word
    if (!current || visibleLength(next) <= HARD_LIMIT) {
      current = next
      continue
    }
    lines.push(current)
    current = word
  }
  if (current) lines.push(current)

  return {
    lines,
    fits: lines.length <= 2 && lines.every((line) => visibleLength(line) <= HARD_LIMIT) && !longWord,
    longWord,
    value: lines.join('<br>'),
  }
}

function classify(value) {
  const currentLines = splitRenderedLines(value)
  const currentLengths = currentLines.map(visibleLength)
  const maxCurrentLength = Math.max(0, ...currentLengths)
  const suggested = wordWrapTwoLines(value)
  const suggestedLengths = suggested.lines.map(visibleLength)
  const maxSuggestedLength = Math.max(0, ...suggestedLengths)

  let status = 'ok'
  if (currentLines.length > 2 || maxCurrentLength > HARD_LIMIT) {
    status = suggested.fits ? 'auto-reflow' : 'manual'
  } else if (maxCurrentLength > TARGET) {
    status = 'watch'
  }

  return {
    status,
    currentLines,
    currentLengths,
    maxCurrentLength,
    suggestedLines: suggested.lines,
    suggestedLengths,
    maxSuggestedLength,
    suggestedValue: suggested.value,
    longWord: suggested.longWord,
  }
}

let files = walk(path.join(ROOT, 'translations', 'novels')).filter((file) => file.endsWith('/ko_KR.json') || file.endsWith('\\ko_KR.json')).sort()
if (args.file) files = [path.resolve(ROOT, args.file)]
if (args.limit != null) files = files.slice(0, args.limit)

const issues = []
const summary = {
  files: 0,
  entries: 0,
  ok: 0,
  watch: 0,
  autoReflow: 0,
  manual: 0,
  fixed: 0,
  fixedFiles: 0,
}

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  let fileChanged = false
  summary.files += 1
  for (const entry of collectEntries(data)) {
    if (typeof entry.value !== 'string') continue
    summary.entries += 1
    const result = classify(entry.value)
    if (result.status === 'ok') summary.ok += 1
    else if (result.status === 'watch') summary.watch += 1
    else if (result.status === 'auto-reflow') summary.autoReflow += 1
    else summary.manual += 1
    if (result.status !== 'ok') {
      issues.push({
        file: rel(file),
        path: entry.path.join(' > '),
        source: entry.key,
        target: entry.value,
        status: result.status,
        currentLengths: result.currentLengths,
        suggestedLengths: result.suggestedLengths,
        suggested: result.suggestedValue,
        longWord: result.longWord,
      })
    }
    if (args.fix && result.status === 'auto-reflow') {
      setByPath(data, entry.path, result.suggestedValue)
      summary.fixed += 1
      fileChanged = true
    }
  }
  if (fileChanged) {
    writeJson(file, data)
    summary.fixedFiles += 1
  }
}

issues.sort((a, b) => {
  const severity = { manual: 0, 'auto-reflow': 1, watch: 2 }
  return severity[a.status] - severity[b.status] || Math.max(...b.currentLengths) - Math.max(...a.currentLengths)
})

fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true })
fs.writeFileSync(REPORT_FILE, `${JSON.stringify({ limits: { target: TARGET, hard: HARD_LIMIT }, summary, issues }, null, 2)}\n`, 'utf8')

console.log('review:novel-layout')
console.log(`files=${summary.files}`)
console.log(`entries=${summary.entries}`)
console.log(`ok=${summary.ok}`)
console.log(`watch=${summary.watch}`)
console.log(`autoReflow=${summary.autoReflow}`)
console.log(`manual=${summary.manual}`)
console.log(`fixed=${summary.fixed}`)
console.log(`fixedFiles=${summary.fixedFiles}`)
console.log(`report=${rel(REPORT_FILE)}`)

for (const issue of issues.slice(0, 12)) {
  console.log(`\n[${issue.status}] ${issue.file} :: ${issue.path}`)
  console.log(`len=${issue.currentLengths.join('/')} -> ${issue.suggestedLengths.join('/')}`)
  console.log(`- ${issue.target.replace(/\n/g, '\\n')}`)
  console.log(`+ ${issue.suggested}`)
}
