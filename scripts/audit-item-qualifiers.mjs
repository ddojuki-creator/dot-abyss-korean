#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

// Regression: the former terminology normalizer erased 交換券 from this item.
// Check source keys, not all BOX labels: the BOX itself must remain a BOX.
const root = process.cwd()
const issues = []
let checked = 0
function visit(data, file, parent = '') {
  for (const [source, value] of Object.entries(data)) {
    const location = parent ? `${parent}/${source}` : source
    if (value && typeof value === 'object') visit(value, file, location)
    else if (source.includes('選べるSSRキャラBOX交換券') && typeof value === 'string') {
      checked++
      if (!value.includes('SSR 캐릭터 선택 BOX 교환권')) issues.push({ file, location, value })
    }
  }
}
for (const type of ['names', 'titles', 'descriptions', 'another_name', 'ability_descriptions', 'outgame', 'static']) {
  const file = path.join('translations', type, 'ko_KR.json')
  if (fs.existsSync(path.join(root, file))) visit(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')), file)
}
const normalizer = fs.readFileSync(path.join(root, 'scripts', 'normalize-terminology.mjs'), 'utf8')
if (/\.replace\(\/SSR 캐릭터 선택 BOX 교환권\/g,\s*'SSR 캐릭터 선택 BOX'\)/.test(normalizer)) {
  issues.push({ file: 'scripts/normalize-terminology.mjs', reason: 'exchange-ticket qualifier stripping rule restored' })
}
console.log(`audit:item-qualifiers checked=${checked} issues=${issues.length}`)
for (const issue of issues) console.log(JSON.stringify(issue))
if (!checked || issues.length) process.exitCode = 1
