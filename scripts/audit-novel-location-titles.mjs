#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readJson, rel, walk } from './lib/ko-pipeline.mjs'

const novelDir = path.join(ROOT, 'translations', 'novels')
const dialogueIndex = path.join(ROOT, '.cache', 'novel-message-index.json')
const locationTitleSource = /<size=48>.*(?:大穴|階層|洞窟|前線基地|研究所|司令|地下鉄|駅|会場|酒場|森|街|倉庫|部屋|宿舎|訓練所).*<\/(?:size)?>/
const japaneseOutsideTags = /[\u3041-\u3096\u30a1-\u30fa\uff66-\uff9d\u3400-\u9fff\u3005\u3006]/u
const collapsedKorean = [
  /어비스(?:빛|얼음|눈|어둠|화산|미답|최심|얕은|내부|안|입구|내)/,
  /(?:빛|얼음|눈|어둠|화산)의?계층/,
  /전선기지(?:사령실|사령부|마켓|주점|숙소|훈련소|창관|근교|주변|밖|내)/,
  /지하철(?:승강장|역)/,
]

const files = walk(novelDir)
  .filter((file) => file.endsWith(`${path.sep}ko_KR.json`))
  .sort()

const issues = []
let checked = 0
const checkedKeys = new Set()

if (!fs.existsSync(dialogueIndex)) {
  issues.push({ type: 'missing-index', file: dialogueIndex })
} else {
  const index = readJson(dialogueIndex)
  const eventCenters = new Map()
  for (const entry of Array.isArray(index) ? index : []) {
    if (entry?.command !== 'messageTextCenter' || !String(entry.novelId || '').startsWith('evs_')) continue
    if (typeof entry.source !== 'string' || !entry.source) continue
    eventCenters.set(`${entry.novelId}\u0000${entry.source}`, entry)
  }

  for (const entry of eventCenters.values()) {
    const file = path.join(novelDir, entry.novelId, 'ko_KR.json')
    checked++
    checkedKeys.add(`${file}\u0000${entry.source}`)
    if (!fs.existsSync(file)) {
      issues.push({ type: 'missing-file', file, source: entry.source, novelId: entry.novelId })
      continue
    }
    const data = readJson(file)
    const value = data[entry.source]
    if (typeof value !== 'string') {
      issues.push({ type: 'missing-key', file, source: entry.source, novelId: entry.novelId })
      continue
    }
    if (value === entry.source || japaneseOutsideTags.test(value.replace(/<[^>]+>/g, ''))) {
      issues.push({ type: 'untranslated', file, source: entry.source, value, novelId: entry.novelId })
    }
  }
}

for (const file of files) {
  const data = readJson(file)
  for (const [source, value] of Object.entries(data)) {
    if (typeof source !== 'string' || typeof value !== 'string') continue
    if (!locationTitleSource.test(source)) continue
    if (checkedKeys.has(`${file}\u0000${source}`)) continue
    checked++
    const plain = value
      .replace(/<[^>]+>/g, '')
      .replace(/[―—ー─]/g, '')
      .trim()

    for (const pattern of collapsedKorean) {
      if (pattern.test(plain)) {
        issues.push({ file, source, value, pattern: pattern.toString() })
        break
      }
    }
  }
}

console.log(`audit:novel-location-titles checked=${checked} issues=${issues.length}`)
for (const issue of issues.slice(0, 30)) {
  if (issue.type === 'missing-index') {
    console.log(`\n[missing-index] ${rel(issue.file)}`)
    console.log('run: scripts/audit-novel-dialogue-metadata.mjs --all-cached --deep-small-textassets --write-index')
    continue
  }
  if (issue.type === 'missing-file' || issue.type === 'missing-key' || issue.type === 'untranslated') {
    console.log(`\n[${issue.type}] ${rel(issue.file)}`)
    console.log(`source : ${JSON.stringify(issue.source)}`)
    if (issue.value) console.log(`value  : ${JSON.stringify(issue.value)}`)
    continue
  }
  console.log(`\n[collapsed-spacing] ${rel(issue.file)}`)
  console.log(`pattern: ${issue.pattern}`)
  console.log(`source : ${JSON.stringify(issue.source)}`)
  console.log(`value  : ${JSON.stringify(issue.value)}`)
}

if (issues.length) process.exitCode = 1
