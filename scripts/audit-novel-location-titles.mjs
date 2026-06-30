#!/usr/bin/env node
import path from 'node:path'
import { ROOT, readJson, rel, walk } from './lib/ko-pipeline.mjs'

const novelDir = path.join(ROOT, 'translations', 'novels')
const locationTitleSource = /<size=48>.*(?:大穴|階層|洞窟|前線基地|研究所|司令|地下鉄|駅|会場|酒場|森|街|倉庫|部屋|宿舎|訓練所).*<\/(?:size)?>/
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

for (const file of files) {
  const data = readJson(file)
  for (const [source, value] of Object.entries(data)) {
    if (typeof source !== 'string' || typeof value !== 'string') continue
    if (!locationTitleSource.test(source)) continue
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
  console.log(`\n[collapsed-spacing] ${rel(issue.file)}`)
  console.log(`pattern: ${issue.pattern}`)
  console.log(`source : ${JSON.stringify(issue.source)}`)
  console.log(`value  : ${JSON.stringify(issue.value)}`)
}

if (issues.length) process.exitCode = 1
