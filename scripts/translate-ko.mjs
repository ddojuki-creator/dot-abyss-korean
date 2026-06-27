#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { collectEntries, compareProtectedTokens, getTargetFiles, loadPrompt, loadState, parseArgs, printSummary, readJson, readPromptVersion, rel, saveState, setByPath, sha1, shouldTranslateValue, stableHash, writeJson, ROOT } from './lib/ko-pipeline.mjs'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const API_KEY = process.env.OPENAI_API_KEY
const BATCH_SIZE = Number(process.env.TRANSLATE_BATCH_SIZE || 20)
const MAX_RETRIES = Number(process.env.TRANSLATE_MAX_RETRIES || 4)
const API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function stripJsonFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

function stateKey(file, entry) {
  return `${rel(file)}::${entry.path.join('\u0001')}`
}

function normalizeTerminology(key, value) {
  let normalized = value
  if (key.includes('\u5927\u7A74')) {
    normalized = normalized.replace(/\ub300\uacf5\ub3d9|\ub300\uad6c\uba4d|\ud070 \uad6c\uba4d|\ub300\ub3d9\uad74/g, '\uc5b4\ube44스')
  }
  if (key.includes('\u932C\u73CD\u8853')) {
    normalized = normalized.replace(/\uc5f0진술|\uc5f0단술/g, '\uc721봉연술')
  }
  if (key.includes('\u30F4\u30A3\u30FC\u30E9')) {
    normalized = normalized.replace(/\ube44\uc774\ub77c/g, '\ube44\ub77c')
  }
  if (key.includes('\u30B4\u30EC\u30A4\u30CC')) {
    normalized = normalized.replace(/고레인느|고레인누|골레누|고레누|고레인/g, '고레이누')
  }
  if (key.includes('\u30B5\u30F3\u30AF\u30C1\u30E5\u30A8\u30FC\u30EB\u5973\u5B66\u5712')) {
    normalized = normalized.replace(/생츄에를 여자학원|생츄에르 여자학원|생츄에를 여학원|생츄에르 여학원/g, '생크추어리 여학원')
  }
  if (key.includes('\u30B5\u30F3\u5973')) {
    normalized = normalized.replace(/산여|생여/g, '생크학원')
  }
  if (key.includes('\u30CE\u30EF\u30FC\u30EB')) {
    normalized = normalized.replace(/\ub178\uc640\ub974|\ub204\uc640\ub974|\ub204\uc544\ub974/g, '\ub290\uc640\ub974')
  }
  if (key.includes('\u30DA\u30EB\u30C7\u30A3\u30AA\u30F3')) {
    normalized = normalized.replace(/펄디온|펠디온/g, '페르디온')
  }
  if (/\u30DF\u30EB\u30C6\u30A3(?:\u30FC?\u30E6|\u30FC\u30E6)/.test(key)) {
    normalized = normalized.replace(/미르티유|밀티유/g, '밀피유')
  }
  if (key.includes('\u30D0\u30C3\u30AF')) {
    normalized = normalized
      .replace(/가방|후위/g, '백')
  }
  if (key.includes('\u30D5\u30ED\u30F3\u30C8')) {
    normalized = normalized.replace(/전위/g, '프론트')
  }
  if (key.includes('\u30AF\u30A4\u30C3\u30AF\u9078\u629E')) {
    normalized = normalized.replace(/퀵 선택/g, '빠른 선택')
  }
  const floorLabel = key.match(/^\u30D5\u30ED\u30A2([123])$/)
  if (floorLabel) {
    normalized = `플로어${floorLabel[1]}`
  }
  if (
    /(?:\u3056\u3053\u3056\u3053|\u3056\u3063\u3053\u3056\u3053|\u30B6\u30B3\u30B6\u30B3|\u3088\u308F\u3088\u308F)/.test(key)
    && /(?:\u304A\u306B\u30FC\u3055\u3093|\u304A\u5144\u3055\u3093|\u5144\u3055\u3093|\u53F8\u4EE4\u5B98)/.test(key)
  ) {
    normalized = normalized
      .replace(/\uc57d\ud574\ube60\uc9c4 \ud5c8\uc811 \uc624\ube60/g, '\ud5c8\uc811 \uc624\ube60')
      .replace(/약한 약한 오빠|약해빠진 오빠|약한 오빠|약골 오빠|쫄보 오빠|잔챙이 오빠/g, '허접 오빠')
      .replace(/\uc7a1\ub2e4\ud55c \uc624\ube60\ub4e4\uc5d0\uac8c/g, '\ud5c8\uc811 \uc624\ube60\uc5d0\uac8c')
      .replace(/\uc57d\ud55c \uc0ac\ub839\uad00|\uc57d\uace8 \uc0ac\ub839\uad00|\ucad0\ubcf4 \uc0ac\ub839\uad00/g, '\ud5c8\uc811 \uc0ac\ub839\uad00')
  }
  if (key.includes('\u3088\u308F\u3088\u308F\u304A\u3061\u3093\u307D')) {
    normalized = normalized.replace(/약골 오빠야|약약한 고추|약한 고추|약골 고추/g, '허접 자지')
  }
  if (/(?:ざこざこ|ざっこざこ|ザコザコ|よわよわ|ざ～こ|ざこじゃ|ざこ炎|ざこざ～～こ)/.test(key)) {
    normalized = normalized
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
    normalized = normalized.replace(/\uc77c\uc6a9(?=<br>|\s*\ucf54\uc2a4\ud2ac)/g, '\uc5c5\ubb34\uc6a9')
  }
  return normalized
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
}

function isDoneInState(state, file, entry, promptVersion) {
  const item = state.items[stateKey(file, entry)]
  if (!item) return false
  return item.status === 'done'
    && item.model === MODEL
    && item.promptVersion === promptVersion
    && item.sourceHash === sha1(entry.key)
    && item.valueHash === sha1(entry.value)
}

function buildMessages(prompt, items) {
  return [
    {
      role: 'system',
      content: [
        'You are a professional Korean localizer for a Japanese 2D subculture game.',
        'Translate only JSON values into natural Korean.',
        'Never modify JSON keys, IDs, tags, or placeholders. Source line breaks may only be reduced according to the Korean layout rules.',
        'Do not leave any Japanese kana outside protected tags; fully rewrite mixed Japanese-Korean values in Korean.',
        'Japanese text inside tag syntax such as <ruby=...> is protected and must remain unchanged.',
        'Return JSON only with this schema: {"items":[{"id":0,"value":"..."}]}.',
        prompt,
      ].join('\n\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        items: items.map((item, id) => ({
          id,
          source_key: item.key,
          current_value: item.value,
        })),
      }, null, 2),
    },
  ]
}

async function callOpenAI(prompt, items) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: buildMessages(prompt, items),
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    if (text.includes('insufficient_quota')) {
      const err = new Error(`OpenAI insufficient_quota: ${text}`)
      err.noRetry = true
      throw err
    }
    throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 1200)}`)
  }
  const data = JSON.parse(text)
  const choice = data.choices?.[0]
  const content = choice?.message?.content
  if (!content) throw new Error('OpenAI response has no message content')
  if (choice.finish_reason === 'length') {
    const err = new Error('OpenAI response was truncated')
    err.splitBatch = true
    throw err
  }

  let parsed
  try {
    parsed = JSON.parse(stripJsonFence(content))
  } catch (cause) {
    const err = new Error(`Invalid OpenAI response JSON: ${cause.message}`)
    err.splitBatch = true
    throw err
  }
  if (!Array.isArray(parsed.items)) {
    const err = new Error('OpenAI response JSON has no items array')
    err.splitBatch = true
    throw err
  }
  const byId = new Map(parsed.items.map((item) => [Number(item.id), item.value]))
  return items.map((item, id) => {
    const responseValue = byId.get(id)
    if (typeof responseValue !== 'string') {
      const err = new Error(`Missing translated value for id=${id}`)
      err.splitBatch = true
      throw err
    }
    const value = normalizeTerminology(item.key, responseValue)
    const tokenErrors = compareProtectedTokens(item.value, value)
    if (tokenErrors.length) {
      const err = new Error(`Protected token mismatch at id=${id}: ${tokenErrors.join(', ')}`)
      err.splitBatch = true
      throw err
    }
    if (shouldTranslateValue(item.key, value)) {
      const err = new Error(`Translation still contains untranslated Japanese at id=${id}`)
      err.splitBatch = true
      throw err
    }
    return value
  })
}

async function translateByLineBreaks(prompt, item) {
  const breakPattern = /(<br(?:\s+[^>]*)?>)/gi
  const valueParts = item.value.split(breakPattern)
  if (valueParts.length < 3) return null

  const keyParts = item.key.split(breakPattern)
  const segmentItems = []
  const segmentIndexes = []
  for (let i = 0; i < valueParts.length; i += 2) {
    if (valueParts[i] === '') continue
    segmentIndexes.push(i)
    segmentItems.push({
      key: keyParts[i] || item.key,
      value: valueParts[i],
    })
  }

  const translatedSegments = await callOpenAI(prompt, segmentItems)
  for (let i = 0; i < segmentIndexes.length; i++) {
    valueParts[segmentIndexes[i]] = translatedSegments[i]
  }

  const value = valueParts.join('')
  const tokenErrors = compareProtectedTokens(item.value, value)
  if (tokenErrors.length) {
    throw new Error(`Protected token mismatch after line split: ${tokenErrors.join(', ')}`)
  }
  return value
}

async function translateWithRetry(prompt, items) {
  let lastError
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callOpenAI(prompt, items)
    } catch (err) {
      lastError = err
      if (err.noRetry) throw err
      if (err.splitBatch && items.length > 1) throw err
      console.warn(`retry ${attempt}/${MAX_RETRIES}: ${err.message.split('\n')[0]}`)
      if (attempt < MAX_RETRIES) await sleep(Math.min(30000, 1000 * 2 ** (attempt - 1)))
    }
  }

  if (items.length === 1 && lastError?.splitBatch && /<br(?:\s+[^>]*)?>/i.test(items[0].value)) {
    console.warn('retrying as <br>-separated segments')
    const value = await translateByLineBreaks(prompt, items[0])
    if (value !== null) return [value]
  }

  throw lastError
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const promptScope = args.scope === 'common' ? 'common' : 'novels'
  const promptVersion = readPromptVersion()
  const prompt = loadPrompt(promptScope)
  const files = getTargetFiles(args)
  const state = loadState()
  state.promptVersion = promptVersion

  if (!args.dryRun && !API_KEY) throw new Error('OPENAI_API_KEY is required unless --dry-run is used')

  let candidates = 0
  let translated = 0
  let skippedByState = 0
  let failedBatches = 0

  console.log(`model=${MODEL}`)
  console.log(`promptVersion=${promptVersion}`)
  console.log(`targetFiles=${files.length}`)

  for (const file of files) {
    const data = readJson(file)
    let entries = collectEntries(data).filter((entry) => shouldTranslateValue(entry.key, entry.value, args))
    if (args.changed) {
      const before = entries.length
      entries = entries.filter((entry) => !isDoneInState(state, file, entry, promptVersion))
      skippedByState += before - entries.length
    }
    candidates += entries.length
    console.log(`\n${rel(file)} candidates=${entries.length}`)
    if (args.dryRun || entries.length === 0) continue

    const pendingBatches = chunk(entries, BATCH_SIZE)
    while (pendingBatches.length > 0) {
      const batch = pendingBatches.shift()
      process.stdout.write(`batch items=${batch.length} ... `)
      try {
        const values = await translateWithRetry(prompt, batch)
        for (let i = 0; i < batch.length; i++) {
          const entry = batch[i]
          const value = values[i]
          setByPath(data, entry.path, value)
          state.items[stateKey(file, entry)] = {
            status: 'done',
            file: rel(file),
            path: entry.path,
            sourceHash: sha1(entry.key),
            valueHash: sha1(value),
            model: MODEL,
            promptVersion,
            at: new Date().toISOString(),
          }
          delete state.failed[stateKey(file, entry)]
        }
        writeJson(file, data)
        saveState(state)
        translated += batch.length
        console.log('ok')
      } catch (err) {
        if (err.splitBatch && batch.length > 1) {
          const middle = Math.ceil(batch.length / 2)
          pendingBatches.unshift(batch.slice(middle))
          pendingBatches.unshift(batch.slice(0, middle))
          console.log(`split ${batch.length} -> ${middle}+${batch.length - middle}`)
          continue
        }

        failedBatches += 1
        for (const entry of batch) {
          state.failed[stateKey(file, entry)] = {
            status: 'failed',
            file: rel(file),
            path: entry.path,
            sourceHash: sha1(entry.key),
            valueHash: sha1(entry.value),
            model: MODEL,
            promptVersion,
            error: err.message,
            at: new Date().toISOString(),
          }
        }
        saveState(state)
        console.log('failed')
        console.error(err.message)
        if (err.noRetry) throw err
      }
    }
  }

  printSummary('translate:ko', { candidates, translated, skippedByState, failedBatches })
  if (!args.dryRun && translated > 0) {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/update-manifest.mjs')], { cwd: ROOT, stdio: 'inherit' })
    if (result.status !== 0) process.exitCode = result.status || 1
  }
  if (failedBatches) process.exitCode = 1
}

main().catch((err) => {
  console.error(err.stack || err.message)
  process.exit(1)
})
