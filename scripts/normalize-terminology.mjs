#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/ko-pipeline.mjs'

const translationsRoot = path.join(ROOT, 'translations')
let changedFiles = 0
let changedValues = 0

function normalize(key, value) {
  let result = value
  if (key.includes('\u5927\u7A74')) {
    result = result.replace(/\ub300\uacf5\ub3d9|\ub300\uad6c\uba4d|\ud070 \uad6c\uba4d|\ub300\ub3d9\uad74/g, '\uc5b4\ube44스')
  }
  if (key.includes('\u932C\u73CD\u8853')) {
    result = result.replace(/\uc5f0진술|\uc5f0단술/g, '\uc721봉연술')
  }
  if (key.includes('\u30F4\u30A3\u30FC\u30E9')) {
    result = result.replace(/\ube44\uc774\ub77c/g, '\ube44\ub77c')
  }
  if (key.includes('\u30CE\u30EF\u30FC\u30EB')) {
    result = result.replace(/\ub178\uc640\ub974|\ub204\uc640\ub974|\ub204\uc544\ub974/g, '\ub290\uc640\ub974')
  }
  if (key.includes('\u30DA\u30EB\u30C7\u30A3\u30AA\u30F3')) {
    result = result.replace(/펄디온|펠디온/g, '페르디온')
  }
  if (/\u30DF\u30EB\u30C6\u30A3(?:\u30FC?\u30E6|\u30FC\u30E6)/.test(key)) {
    result = result.replace(/밀피유|미르티유/g, '밀티유')
  }
  if (key.includes('\u30DE\u30C3\u30AF\u30F3')) {
    result = result.replace(/맛쿤/g, '마쿤')
  }
  if (key.includes('\u30B8\u30A7\u30F3\u30DE')) {
    result = result.replace(/젠마/g, '젬마')
  }
  if (key.includes('\u30B9\u30C6\u30A3\u30FC\u30E9')) {
    result = result.replace(/스틸라/g, '스티라')
  }
  if (key.includes('\u30E9\u30F4\u30A7\u30EA\u30A2')) {
    result = result.replace(/라벨리아/g, '라베리아')
  }
  if (key.includes('\u30EC\u30A4\u30BC\u30EA\u30A2')) {
    result = result.replace(/레이젤리아/g, '레이제리아')
  }
  if (key.includes('\u30A8\u30EB\u30C9\u30E9\u30FC\u30CA')) {
    result = result.replace(/엘도라나/g, '엘드라나')
  }
  if (key.includes('\u30E1\u30EC\u30E0')) {
    result = result.replace(/멜렘/g, '메렘')
  }
  if (key.includes('\u30E1\u30EA\u30C3\u30B5')) {
    result = result.replace(/메리사/g, '멜리사')
  }
  if (key.includes('\u30D0\u30C3\u30AF')) {
    result = result
      .replace(/가방|후위/g, '백')
  }
  if (key.includes('\u30D5\u30ED\u30F3\u30C8')) {
    result = result.replace(/전위/g, '프론트')
  }
  if (key.includes('\u30AF\u30A4\u30C3\u30AF\u9078\u629E')) {
    result = result.replace(/퀵 선택/g, '빠른 선택')
  }
  if (key.includes('\u30D4\u30C3\u30B1\u30EB')) {
    result = result.replace(/픽켈|피켈|곡괭이/g, '곡갱이')
  }
  if (key.includes('\u98E2\u9913')) {
    result = result.replace(/굶주림/g, '기아')
  }
  if (key.includes('\u30AB\u30CE\u30F3\u30B3\u30FC\u30EB')) {
    result = result.replace(/카논 콜/g, '캐논 콜')
  }
  if (key === '\u571F' || key.includes('\u571F\u5C5E\u6027') || key.includes('\u706B\u3001\u6C34\u3001\u571F') || key.includes('\u706B\u30FB\u6C34\u30FB\u571F')) {
    result = result
      .replace(/흙\s*속성/g, '토 속성')
      .replace(/흙속성/g, '토속성')
      .replace(/\[흙\]/g, '[토]')
  }
  if (key.includes('\u9078\u3079\u308B') && /BOX|\u30DC\u30C3\u30AF\u30B9/.test(key)) {
    result = result
      .replace(/선택 가능한 ([^\n]*?) BOX/g, '$1 선택 BOX')
      .replace(/선택 가능한 ([^\n]*?) 상자/g, '$1 선택 BOX')
      .replace(/SSR 캐릭터 선택 BOX 교환권/g, 'SSR 캐릭터 선택 BOX')
  }
  const floorLabel = key.match(/^\u30D5\u30ED\u30A2([123])$/)
  if (floorLabel) {
    result = `플로어${floorLabel[1]}`
  }
  if (
    /(?:\u3056\u3053\u3056\u3053|\u3056\u3063\u3053\u3056\u3053|\u30B6\u30B3\u30B6\u30B3|\u3088\u308F\u3088\u308F)/.test(key)
    && /(?:\u304A\u306B\u30FC\u3055\u3093|\u304A\u5144\u3055\u3093|\u5144\u3055\u3093|\u53F8\u4EE4\u5B98)/.test(key)
  ) {
    result = result
      .replace(/\uc57d\ud574\ube60\uc9c4 \ud5c8\uc811 \uc624\ube60/g, '\ud5c8\uc811 \uc624\ube60')
      .replace(/약한 약한 오빠|약해빠진 오빠|약한 오빠|약골 오빠|쫄보 오빠|잔챙이 오빠/g, '허접 오빠')
      .replace(/\uc7a1\ub2e4\ud55c \uc624\ube60\ub4e4\uc5d0\uac8c/g, '\ud5c8\uc811 \uc624\ube60\uc5d0\uac8c')
      .replace(/\uc57d\ud55c \uc0ac\ub839\uad00|\uc57d\uace8 \uc0ac\ub839\uad00|\ucad0\ubcf4 \uc0ac\ub839\uad00/g, '\ud5c8\uc811 \uc0ac\ub839\uad00')
  }
  if (key.includes('\u3088\u308F\u3088\u308F\u304A\u3061\u3093\u307D')) {
    result = result.replace(/약골 오빠야|약약한 고추|약한 고추|약골 고추/g, '허접 자지')
  }
  if (/(?:ざこざこ|ざっこざこ|ザコザコ|よわよわ|ざ～こ|ざこじゃ|ざこ炎|ざこざ～～こ)/.test(key)) {
    result = result
      .replace(/정말 약골이구나/g, '정말 허접이구나')
      .replace(/그저 그런 사령관 오빠/g, '허접 사령관 오빠')
      .replace(/약골♡ 약골♡/g, '허접♡ 허접♡')
      .replace(/약골 광석/g, '허접 광석')
      .replace(/약한 불/g, '허접한 불')
      .replace(/약하네/g, '허접이네')
      .replace(/약골 약골 고추/g, '허접허접 자지')
      .replace(/약골 몬스터/g, '허접 몬스터')
      .replace(/보잘것없는 평범한 인간들/g, '허접한 평범한 인간들')
      .replace(/마법도 못 쓰는 약골이니까/g, '마법도 못 쓰는 허접이니까')
  }
  if (key.includes('\u304A\u3057\u3054\u3068\u7528') && key.includes('\u30B3\u30B9\u30C1\u30E5\u30FC\u30E0')) {
    result = result.replace(/\uc77c\uc6a9(?=<br>|\s*\ucf54\uc2a4\ud2ac)/g, '\uc5c5\ubb34\uc6a9')
  }
  result = result
    .replace(/닷트 어비스/g, '도트 어비스')
    .replace(/어비스을/g, '어비스를')
    .replace(/어비스은/g, '어비스는')
    .replace(/어비스과/g, '어비스와')
    .replace(/어비스으로/g, '어비스로')
    .replace(/어비스이(?=\s*(?:있는|나타난|평화로운|얼마나))/g, '어비스가')
    .replace(/어비스이(?=구나|군)/g, '어비스')
    .replace(/어비스이(?=니까)/g, '어비스')
    .replace(/어비스이(?=라면|라서|라도|라\?|라는|라고)/g, '어비스')
    .replace(/고마움으로 베리사쨩의/g, '보답으로 베리사쨩의')
    .replace(/가게에서 대인기예요/g, '가게에서 큰 인기예요')
    .replace(/형님은 누구를 데리고 갈 건가요~/g, '오빠는 누구를 데리고 갈 건가요~')
  return result
}

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'manifest') visit(file)
      continue
    }
    if (entry.name !== 'ko_KR.json') continue

    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    let fileChanged = false
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'string') continue
      const normalized = normalize(key, value)
      if (normalized === value) continue
      data[key] = normalized
      changedValues += 1
      fileChanged = true
    }
    if (fileChanged) {
      fs.writeFileSync(file, `${JSON.stringify(data, null, 4)}\n`, 'utf8')
      changedFiles += 1
    }
  }
}

visit(translationsRoot)
console.log(`normalize:terminology files=${changedFiles} values=${changedValues}`)
