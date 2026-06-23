#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/ko-pipeline.mjs'

const DISPLAY_TABLES = new Set([
  'm_part_voices',
  'm_battle_result_reactions',
  'm_disaster_boss_messages',
  'm_interaction_voices',
  'm_idle_exploration_log_messages',
  'm_plan_step_serifs',
  'm_tavern_dialogue',
  'm_transition_tips',
])

const dryRun = process.argv.includes('--dry-run')
const snapshotFile = path.join(ROOT, 'snapshots', 'game-cache-ja_JP.json')
const translationFile = path.join(ROOT, 'translations', 'outgame', 'ko_KR.json')
const MANUAL_REFLOWS = new Map([
  ['주인님, 쿠루루가 부탁이 있어요~ 이 기지는 뭔가 쓸쓸하달까 행복한 기분이 부족한 것 같아요~', '주인님, 쿠루루가 부탁이 있어요~\n이 기지는 뭔가 쓸쓸하달까 행복한 기분이 부족한 것 같아요~'],
  ['홀로그램으로 실례합니다. 이 모습이 보이는 편이 대화하기 편하시죠?', '홀로그램으로 실례합니다.\n이 모습이 보이는 편이 대화하기 편하시죠?'],
  ['아이고~ 아무리 나리라도, 이 이상은 추가 요금 받는다구요~?', '아이고~ 아무리 나리라도,\n이 이상은 추가 요금 받는다구요~?'],
  ['천재 겸 변태 과학자의 지능으로 이 전선 기지에 특별한 시설을 지어드리겠습니다!', '천재 겸 변태 과학자의 지능으로\n이 전선 기지에 특별한 시설을 지어드리겠습니다!'],
])

function smartJoin(lines) {
  return lines.map((line) => line.trim()).filter(Boolean).join(' ')
}

function visibleLength(value) {
  return [...value.replace(/<[^>]+>/g, '')].length
}

function bestTwoLines(lines) {
  let best = null
  for (let split = 1; split < lines.length; split += 1) {
    const first = smartJoin(lines.slice(0, split))
    const second = smartJoin(lines.slice(split))
    const firstLength = visibleLength(first)
    const secondLength = visibleLength(second)
    const overflow = Math.max(0, firstLength - 35) + Math.max(0, secondLength - 35)
    const orphanPenalty = /^게(?=\s|$)/.test(second) ? 1000 : 0
    const score = overflow * 100 + orphanPenalty + Math.abs(firstLength - secondLength)
    if (!best || score < best.score) best = { score, value: `${first}\n${second}` }
  }
  return best?.value ?? lines.join('\n')
}

function reflowShortText(value) {
  const words = value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
  if (words.length < 2) return value
  const totalLength = visibleLength(words.join(' '))
  if (totalLength <= 35 || totalLength > 70) return value
  return bestTwoLines(words)
}

const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'))
const sourceTables = new Map()
for (const [location, source] of Object.entries(snapshot.entries)) {
  const table = location.split('/', 1)[0]
  if (!DISPLAY_TABLES.has(table)) continue
  if (!sourceTables.has(source)) sourceTables.set(source, new Set())
  sourceTables.get(source).add(table)
}

const translations = JSON.parse(fs.readFileSync(translationFile, 'utf8'))
const samples = []
let candidates = 0
let changed = 0

for (const [source, value] of Object.entries(translations)) {
  if (!sourceTables.has(source) || typeof value !== 'string' || value.includes('<br')) continue
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const maxLength = Math.max(...lines.map(visibleLength))
  const compact = smartJoin(lines)
  const manual = MANUAL_REFLOWS.get(compact)
  const startsWithOrphan = lines.slice(1).some((line) => /^게(?=\s|$)/.test(line))
  if (!manual && lines.length <= 2 && maxLength <= 35 && !startsWithOrphan) continue
  candidates += 1
  const reviewed = manual ?? reflowShortText(value)
  if (reviewed === value) continue
  translations[source] = reviewed
  changed += 1
  if (samples.length < 8) samples.push({ before: value, after: reviewed })
}

if (!dryRun && changed > 0) {
  fs.writeFileSync(translationFile, `${JSON.stringify(translations, null, 4)}\n`, 'utf8')
}

console.log(`review:layout candidates=${candidates} changed=${changed} dryRun=${dryRun}`)
for (const sample of samples) {
  console.log(`\n- ${sample.before.replace(/\n/g, ' / ')}`)
  console.log(`+ ${sample.after.replace(/\n/g, ' / ')}`)
}
