#!/usr/bin/env node
import fs from 'node:fs'

const file = 'translations/outgame/ko_KR.json'
const fix = process.argv.includes('--fix')

const purple = '#AC83FD'
const green = '#4CF37B'
const coloredTermRe = new RegExp(`<color=${purple}>「(?:드링크|접객|요리|엘드라나|페르디온|미레스갈드|천국연합)」</color>`, 'g')
const coloredPercentRe = new RegExp(`<color=${green}>\\d+(?:\\.\\d+)?%</color>`, 'g')

const sourceTermRe = /ドリンク|接客|料理|エルドラーナ|ペルディオン|ミレスガルド|千国連合/
const sourceProposalRe = /スタッフ|おしごと|営業カード|満足度|VIP|フロア|ラウンジ|個室|付与|ランダムな|次ターン/
const targetTermRe = /드링크|접객|요리|엘드라나|페르디온|미레스갈드|천국연합|만족도/

const terms = ['드링크', '접객', '요리', '엘드라나', '페르디온', '미레스갈드', '천국연합']

function protect(text, re) {
  const saved = []
  const marked = text.replace(re, (match) => {
    const marker = `\uE000${saved.length}\uE000`
    saved.push(match)
    return marker
  })
  return {
    marked,
    restore(value) {
      return value.replace(/\uE000(\d+)\uE000/g, (_, index) => saved[Number(index)])
    },
  }
}

function shouldCheck(key, value) {
  if (!sourceTermRe.test(key) || !sourceProposalRe.test(key)) return false
  return targetTermRe.test(value)
}

function colorTerms(value) {
  let state = protect(value, coloredTermRe)
  let out = state.marked
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out
      .replace(new RegExp(`「${escaped}」`, 'g'), `<color=${purple}>「${term}」</color>`)
      .replace(new RegExp(`'${escaped}'`, 'g'), `<color=${purple}>「${term}」</color>`)
      .replace(new RegExp(`‘${escaped}’`, 'g'), `<color=${purple}>「${term}」</color>`)
  }
  return state.restore(out)
}

function colorPercents(value) {
  let state = protect(value, coloredPercentRe)
  const out = state.marked.replace(/\+(\d+(?:\.\d+)?%)/g, `+<color=${green}>$1</color>`)
  return state.restore(out)
}

function normalizeValue(value) {
  return colorPercents(colorTerms(value))
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'))
const issues = []
let changed = 0

for (const [key, value] of Object.entries(data)) {
  if (typeof value !== 'string' || !shouldCheck(key, value)) continue
  const next = normalizeValue(value)
  if (next === value) continue
  issues.push({ key, value, next })
  if (fix) {
    data[key] = next
    changed += 1
  }
}

if (fix && changed) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

console.log('\naudit:outgame-proposal-colors')
console.log(`checked=${Object.keys(data).length}`)
console.log(`issues=${issues.length}`)
console.log(`fixed=${fix ? changed : 0}`)

if (issues.length) {
  console.log('\nSamples:')
  for (const issue of issues.slice(0, 40)) {
    console.log(`- ${issue.key.replaceAll('\n', '\\n')}`)
    console.log(`  before: ${issue.value.replaceAll('\n', '\\n')}`)
    console.log(`  after : ${issue.next.replaceAll('\n', '\\n')}`)
  }
}

if (issues.length && !fix) process.exitCode = 1
