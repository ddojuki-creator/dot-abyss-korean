#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, shouldTranslateValue } from './lib/ko-pipeline.mjs'

const CRITICAL_TABLES = new Set([
  'm_battle_result_reactions',
  'm_disaster_boss_messages',
  'm_idle_exploration_log_messages',
  'm_interaction_voices',
  'm_part_voices',
  'm_plan_step_serifs',
  'm_tavern_dialogue',
  'm_transition_tips',
])

const HARDCODED_UI_TEXTS = new Set([
  'プレゼントボックス',
  '未受け取り数',
])

const args = new Set(process.argv.slice(2))
const addedOnly = args.has('--added-only')
const noFail = args.has('--no-fail')
const snapshotFile = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const reportFile = path.join(ROOT, '.cache', 'game-cache-extract-report.json')
const translationFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')

function tableOf(location) {
  return location.split('/', 1)[0]
}

function truncate(value, max = 120) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

if (!fs.existsSync(snapshotFile)) throw new Error(`Missing snapshot: ${snapshotFile}`)
if (!fs.existsSync(translationFile)) throw new Error(`Missing outgame translation: ${translationFile}`)

const snapshot = readJson(snapshotFile)
const translations = readJson(translationFile)
let entries = Object.entries(snapshot.entries || {}).map(([location, source]) => ({ location, source }))

if (addedOnly) {
  if (!fs.existsSync(reportFile)) throw new Error(`Missing extract report for --added-only: ${reportFile}`)
  const report = readJson(reportFile)
  const changed = [
    ...(report.changes?.added || []).map((item) => ({ location: item.location, source: item.source })),
    ...(report.changes?.changed || []).map((item) => ({ location: item.location, source: item.after })),
  ]
  const changedLocations = new Set(changed.map((item) => item.location))
  entries = entries
    .filter((item) => changedLocations.has(item.location))
    .map((item) => changed.find((changedItem) => changedItem.location === item.location) || item)
}

const byTable = new Map()
const issues = []
for (const item of entries) {
  const table = tableOf(item.location)
  if (!CRITICAL_TABLES.has(table)) continue
  byTable.set(table, (byTable.get(table) || 0) + 1)
  const value = translations[item.source]
  if (typeof value !== 'string' || value === item.source || shouldTranslateValue(item.source, value)) {
    issues.push({ ...item, table, value })
  }
}

for (const source of HARDCODED_UI_TEXTS) {
  const table = 'hardcoded-ui'
  byTable.set(table, (byTable.get(table) || 0) + 1)
  const value = translations[source]
  if (typeof value !== 'string' || value === source || shouldTranslateValue(source, value)) {
    issues.push({ location: `hardcoded-ui/${source}`, source, table, value })
  }
}

console.log(`audit:outgame-critical scope=${addedOnly ? 'added-or-changed' : 'all-critical'} checked=${[...byTable.values()].reduce((a, b) => a + b, 0)} issues=${issues.length}`)
for (const [table, count] of [...byTable].sort(([a], [b]) => a.localeCompare(b))) {
  const tableIssues = issues.filter((item) => item.table === table).length
  console.log(`- ${table}: checked=${count} issues=${tableIssues}`)
}

for (const item of issues.slice(0, 30)) {
  const status = item.value == null ? 'missing' : item.value === item.source ? 'untranslated' : 'japanese-leftover'
  console.log(`\n[${status}] ${item.location}`)
  console.log(`source: ${truncate(JSON.stringify(item.source))}`)
  if (item.value != null) console.log(`value : ${truncate(JSON.stringify(item.value))}`)
}

if (issues.length && !noFail) {
  process.exitCode = 1
}
