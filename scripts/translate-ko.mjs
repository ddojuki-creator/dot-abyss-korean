#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { collectEntries, compareProtectedTokens, getByPath, getTargetFiles, loadPrompt, loadState, parseArgs, printSummary, readJson, readPromptVersion, rel, saveState, setByPath, sha1, shouldTranslateValue, stableHash, writeJson, ROOT } from './lib/ko-pipeline.mjs'

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const API_KEY = process.env.OPENAI_API_KEY
const BATCH_SIZE = Number(process.env.TRANSLATE_BATCH_SIZE || 20)
const BATCH_DELAY_MS = Number(process.env.TRANSLATE_BATCH_DELAY_MS || 0)
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

function loadGitHeadData(file) {
  const result = spawnSync('git', ['-c', `safe.directory=${ROOT}`, 'show', `HEAD:${rel(file)}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false,
  })
  if (result.status !== 0) return {}
  return JSON.parse(result.stdout)
}

function loadNovelSpeakerIndex() {
  const indexFile = path.join(ROOT, '.cache', 'novel-message-index.json')
  if (!fs.existsSync(indexFile)) return new Map()

  const result = new Map()
  for (const record of readJson(indexFile)) {
    if (!record?.novelId || typeof record.source !== 'string') continue
    const key = `${record.novelId}\u0000${record.source}`
    if (!result.has(key)) result.set(key, new Set())
    if (record.speaker) result.get(key).add(record.speaker)
  }
  return result
}

const KUREHA_DANNA_KEYS = new Set([
  'ありがとうございます、旦那様。\n鬼族と人が仲良くなれる日が\n来るなんて……夢のようですっ',
  'それでは鬼族のみんな……！\n次は旦那様とシラエスママを\nもてなしますよ～♪',
  '愛する旦那様のために……',
  '私としたことが……これでは\n旦那様に顔向けできません……',
  '私と旦那の愛のパワーで、\n必ずや鬼ヶ島のプロデュースを\n成功させてみせます！',
  '旦那様',
  '旦那様～♪　観光客のみなさまに\nお出しする料理ができました♪\n味見してください、あ～～ん♪',
  '旦那様が私と一緒に鬼ヶ島へ\n里帰りしてくださるのですか！？\nもしや結婚の挨拶のために！？',
  '旦那様と仲を深めるために',
  '旦那様のことを愛しています',
  '服に血がついたわ。旦那様に\n会う前に綺麗にしないと……',
  '――旦那様。 <br>私がお力になりましょうか？',
  '立ち聞きをするつもりはなかったのですが、 <br>旦那様の苦しげな声をお聞きして、つい……',
  'もちろんです。 <br>だからこそ旦那様のお力になりたいと思うのです。',
  'どんなことがあっても私の心が旦那様から離れることはありません。 <br>それを証明させてはいただけませんか。',
  'はい……！<br>必ず旦那様の期待に応えてみせますね。',
  '旦那様？　この大砲を運びたいのですか？',
  '（ん？　本当にこれでいいのでしょうか？　殿方はか弱い女性を好むと<br>聞いたことがあります……もし旦那様もそうなのだとしたら……）',
  'はううぅぅ……旦那様ぁぁ……やっぱり重いですぅ～～。<br>私ったらなんてか弱いのでしょう……た、助けてくださぁ～～い……',
  'おかえりなさいませ、旦那様。<br>ご飯にしますか？　お風呂にしますか？　それとも、わ・た・し？',
  'ごっこ遊びに付き合っていただきありがとうございます、旦那様。<br>できればこれからもお出迎えする言葉は、今のものがいいのですが……',
  'いいのですか？<br>ふふ、ありがとうございます。お慕いしていますよ、旦那様……',
])

function normalizeKurehaDannaAddress(value) {
  return value
    .replace(/나리님/g, '서방님')
    .replace(/나리께서/g, '서방님께서')
    .replace(/나리께/g, '서방님께')
    .replace(/나리에게/g, '서방님께')
    .replace(/나리와/g, '서방님과')
    .replace(/나리의/g, '서방님의')
    .replace(/나리를/g, '서방님을')
    .replace(/주인님/g, '서방님')
    .replace(/나리/g, '서방님')
}

function normalizeKotonoDannaAddress(value) {
  return value
    .replace(/나리를/g, '주군을')
    .replace(/나리는/g, '주군은')
    .replace(/나리가/g, '주군이')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)께서/g, '주군께서')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)께/g, '주군께')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)의/g, '주군의')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)과/g, '주군과')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)와/g, '주군과')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)을/g, '주군을')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)은/g, '주군은')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)이/g, '주군이')
    .replace(/(?:서방님|주인님|주군님|남편님|나리님|나리)도/g, '주군도')
    .replace(/서방님|주인님|주군님|남편님|나리님|서방|남편|여보|나리/g, '주군')
    .replace(/주군를/g, '주군을')
    .replace(/주군는/g, '주군은')
    .replace(/주군가/g, '주군이')
    .replace(/주군와/g, '주군과')
}

function normalizeSpeakerTerminology(key, value, speakers = []) {
  if (speakers.length === 1 && speakers[0] === 'コトノ') {
    let normalized = value
    if (/<user>殿/.test(key)) normalized = normalized.replace(/<user>(?:님|공)/g, '<user>공')
    if (/旦那(?:様|さま)?/.test(key)) normalized = normalizeKotonoDannaAddress(normalized)
    return normalized
  }
  return value
}

function trimNovelLineBreaks(source, value) {
  const breakPattern = /<br(?:\s+[^>]*)?>|\\r\\n|\\[nr]|\r\n|\r|\n/gi
  const maxBreaks = source.match(breakPattern)?.length || 0
  let kept = 0
  return value
    .replace(breakPattern, (match) => {
      if (kept >= maxBreaks) return ' '
      kept++
      return match
    })
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function normalizeOnigashimaProduce(value) {
  return value
    .replace(/프로듀스 계획/g, '홍보 계획')
    .replace(/프로듀스 대작전/g, '홍보 대작전')
    .replace(/프로듀스한다는/g, '홍보한다는')
    .replace(/프로듀스하는/g, '홍보하는')
    .replace(/프로듀스하기/g, '홍보하기')
    .replace(/프로듀스하려/g, '홍보하려')
    .replace(/프로듀스할/g, '홍보할')
    .replace(/프로듀스는/g, '홍보는')
    .replace(/프로듀스를/g, '홍보를')
    .replace(/프로듀스에/g, '홍보에')
    .replace(/프로듀스/g, '홍보')
}

function stateKey(file, entry) {
  return `${rel(file)}::${entry.path.join('\u0001')}`
}

function normalizeTerminology(key, value) {
  let normalized = value
  if (key.includes('イライザ')) {
    normalized = normalized.replace(/이라이자|이라이저|일라이저/g, '일라이자')
  }
  if (key.includes('エアリエル')) {
    normalized = normalized.replace(/에어리얼|에아리엘/g, '에어리엘')
  }
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
    normalized = normalized.replace(/밀피유|미르티유/g, '밀티유')
  }
  if (key.includes('\u30B0\u30E9\u30C7\u30A3\u30A2') || key.includes('\u30B0\u30E9\u30C6\u30A3\u30A2')) {
    normalized = normalized.replace(/그라디아|그라티아|글라티아/g, '글라디아')
  }
  if (key.includes('\u30AF\u30EC\u30CF')) {
    normalized = normalized.replace(/크레하/g, '쿠레하')
  }
  if (key.includes('\u30D0\u30D6\u307F')) {
    normalized = normalized.replace(/바붐/g, '바부미')
  }
  if (KUREHA_DANNA_KEYS.has(key) || (/(?:クレハ|鬼ヶ島|鬼族|シラエス)/.test(key) && /旦那(?:様|さま)?/.test(key))) {
    normalized = normalizeKurehaDannaAddress(normalized)
  }
  if (key.includes('\u30B7\u30E9\u30A8\u30B9')) {
    normalized = normalized.replace(/실라에스|시라이스|시라에쓰/g, '시라에스')
  }
  if (key.includes('\u30D5\u30A3\u30AA\u30CA')) {
    normalized = normalized.replace(/피오너|피오나아/g, '피오나')
  }
  if (key.includes('\u30AF\u30EA\u30B9\u30C6\u30A3')) {
    normalized = normalized.replace(/크리스티이|크리스티ー/g, '크리스티')
  }
  if (key.includes('\u60C5\u71B1')) {
    normalized = normalized.replace(/정열/g, '열정')
  }
  if (key.includes('\u30DD\u30D1\u30D1\u30DD\u30D1') && !key.includes('\u30DD\u30D1\u30DD\u30D1\u30D1')) {
    normalized = normalized.replace(/포파포파|포파파파|포파포파파/g, '포파파포파')
  }
  if (key.includes('\u30DD\u30D1\u30DD\u30D1\u30D1') && !key.includes('\u30DD\u30D1\u30D1\u30DD\u30D1')) {
    normalized = normalized.replace(/포파파파|포파파포파/g, '포파포파파')
  }
  if (key.includes('\u30D1\u30DD\u30D7\u30D4\u30D1')) {
    normalized = normalized.replace(/파포프피파|파포푸피파아/g, '파포푸피파')
  }
  if (key.includes('\u30D1\u30D1\u30DD\u30D1\u30D1')) {
    normalized = normalized.replace(/파파포파파아/g, '파파포파파')
  }
  if (key.includes('\u30D7\u30D4\u30D1\u30D4\u30D7')) {
    normalized = normalized.replace(/푸피파피프|푸피파피푸우/g, '푸피파피푸')
  }
  if (key.includes('\u30DD\u30DD\u30DD\u30DD\u30DD')) {
    normalized = normalized.replace(/포포포포포오/g, '포포포포포')
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
  if (key.includes('\u98E2\u9913')) {
    normalized = normalized.replace(/굶주림/g, '기아')
  }
  if (key.includes('\u30AB\u30CE\u30F3\u30B3\u30FC\u30EB') || /\u30AD\u30E3\u30CE\u30F3\s*\u30B3\u30FC\u30EB/.test(key)) {
    normalized = normalized.replace(/카논\s*콜|카논콜|캐넌\s*콜|캐넌콜|캐논콜/g, '캐논 콜')
  }
  if (key.includes('\u9B54\u5C0E\u7089')) {
    normalized = normalized.replace(/마도\s*노심|마도노심/g, '마도로')
  }
  if (/\u8089\u68D2|\u7537\u6839|\u9670\u830E|\u7537\u6027\u5668/.test(key)) {
    normalized = normalized
      .replace(/고기봉/g, '남근')
      .replace(/정액 전체/g, '남근 전체')
      .replace(/정액을 조여/g, '남근을 조여')
      .replace(/정액에 힘/g, '남근에 힘')
      .replace(/몸이 움찔하며 정액이 차오른다/g, '남근이 움찔 떨리고 만다')
  }
  if (/\u81A3(?:\u58C1|\u7656)/.test(key)) {
    normalized = normalized.replace(/질 습관/g, '질벽')
  }
  if (key.includes('\u53F8\u4EE4\u5BA4') || key.includes('\u3057\u308C\u30FC\u3057\u3064')) {
    normalized = normalized.replace(/지휘실/g, '사령실')
  }
  if (key.includes('\u9B3C\u30F6\u5CF6')) {
    normalized = normalized.replace(/귀신\s*섬|귀신섬|귀가섬|오니가\s*섬/g, '오니가시마')
  }
  if (key.includes('\u30D7\u30ED\u30C7\u30E5\u30FC\u30B9')) {
    normalized = normalizeOnigashimaProduce(normalized)
  }
  if (key.includes('\u982D\u3092\u60A9\u307E\u305B')) {
    normalized = normalized
      .replace(/골머리를 앓고/g, '골치를 썩이고')
      .replace(/머리를 앓고/g, '골치를 썩이고')
  }
  if (key.includes('\u9B3C\u9000\u6CBB') || key.includes('\u9B3C\u3068\u5354\u529B')) {
    normalized = normalized
      .replace(/귀퇴치/g, '오니 퇴치')
      .replace(/귀 퇴치/g, '오니 퇴치')
      .replace(/귀와 협력/g, '오니와 협력')
  }
  if (key === '\u9B3C') {
    normalized = normalized.replace(/^귀$/g, '오니')
  }
  if (key.includes('\u9B3C\u65CF')) {
    normalized = normalized
      .replace(/귀족족|강족/g, '오니족')
      .replace(/귀족/g, '오니족')
  }
  if (key.includes('\u9B3C\u65CF\u3068\u4EBA\u9593\u3068')) {
    normalized = normalized.replace(/오니족과 인간과/g, '오니족과 인간')
  }
  if (key.includes('\u7F85\u5239')) {
    normalized = normalized.replace(/라살/g, '나찰')
  }
  if (key.includes('\u706B')) {
    normalized = normalized.replace(/\(火\)/g, '(화)')
  }
  if (key.includes('\u5473\u65B9')) {
    normalized = normalized.replace(/味方/g, '아군')
  }
  if (
    (key.includes('\u524D\u885B') || key.includes('\u5F8C\u885B'))
    && /\u5473\u65B9|\u6575|\u30AD\u30E3\u30E9|\u653B\u6483\u529B|\u9632\u5FA1\u529B|\u8010\u6027|\u30B9\u30AD\u30EB|\u7DE8\u6210|\u52B9\u679C|\u4ED8\u4E0E|\u4E0A\u6607/.test(key)
  ) {
    normalized = normalized
      .replace(/전위/g, '프론트')
      .replace(/후위/g, '백')
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
  if (key.includes('\uFF11\uFF10\u5E74') || key.includes('\u5341\u5E74')) {
    normalized = normalized.replace(/10년/g, '십 년')
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
    .replace(/<ruby=大穴>어비스<\/ruby>/g, '어비스')
    .replace(/무\(無\)/g, '무')
    .replace(/업화\(業火\)/g, '업화')
    .replace(/환수\(幻獣\)/g, '환수')
    .replace(/바부미이라는/g, '바부미라는')
    .replace(/오니가시마으로/g, '오니가시마로')
    .replace(/오니가시마을/g, '오니가시마를')
    .replace(/오니가시마의 홍보/g, '오니가시마 홍보')
    .replace(/나리가라도/g, '나리라도')
    .replace(/나리가기에/g, '나리라서')
    .replace(/나리가세요/g, '나리세요')
    .replace(/나리가었으면/g, '나리였으면')
    .replace(/나리가라면/g, '나리라면')
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
        'Preserve the exact number and type of line-break tokens for common/UI resources. Never add literal newlines or <br> tags that are not present in the source value.',
        'Do not leave any Japanese kana outside protected tags; fully rewrite mixed Japanese-Korean values in Korean.',
        'For novel dialogue, speaker metadata is authoritative. Apply a character card only when exactly one speaker is listed; if speakers are empty or ambiguous, use neutral natural Korean.',
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
          novel_id: item.novelId || null,
          speakers: item.speakers || [],
        })),
      }, null, 2),
    },
  ]
}

async function callOpenAI(prompt, items, options = {}) {
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
    let value = normalizeTerminology(item.key, responseValue)
    value = normalizeSpeakerTerminology(item.key, value, item.speakers)
    if (item.novelId) value = trimNovelLineBreaks(item.value, value)
    if (options.removeAddedLineBreaks) {
      value = value
        .replace(/<br(?:\s+[^>]*)?>/gi, ' ')
        .replace(/\\r\\n|\\[nr]|\r\n|\r|\n/g, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    }
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
  const breakPattern = /(<br(?:\s+[^>]*)?>|\\r\\n|\\[nr]|\r\n|\r|\n)/gi
  const valueParts = item.value.split(breakPattern)
  const keyParts = item.key.split(breakPattern)
  const segmentItems = []
  const segmentIndexes = []
  for (let i = 0; i < valueParts.length; i += 2) {
    const segmentKey = keyParts[i] || item.key
    if (valueParts[i] === '' || !shouldTranslateValue(segmentKey, valueParts[i])) continue
    segmentIndexes.push(i)
    segmentItems.push({
      key: segmentKey,
      value: valueParts[i],
    })
  }

  const translatedSegments = []
  for (const batch of chunk(segmentItems, BATCH_SIZE)) {
    translatedSegments.push(...await callOpenAI(prompt, batch, { removeAddedLineBreaks: true }))
  }
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

  if (items.length === 1 && lastError?.splitBatch) {
    console.warn('retrying as line-break-preserving segments')
    const value = await translateByLineBreaks(prompt, items[0])
    return [value]
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
  const novelSpeakers = promptScope === 'novels' ? loadNovelSpeakerIndex() : new Map()
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
    if (promptScope === 'novels') {
      const novelId = path.basename(path.dirname(file))
      entries = entries.map((entry) => ({
        ...entry,
        novelId,
        speakers: [...(novelSpeakers.get(`${novelId}\u0000${entry.key}`) || [])].sort(),
      }))
    }
    if (args.gitAdded) {
      const headData = loadGitHeadData(file)
      entries = entries.filter((entry) => getByPath(headData, entry.path) === undefined)
    }
    if (args.failedOnly) {
      entries = entries.filter((entry) => {
        const failed = state.failed[stateKey(file, entry)]
        return failed?.model === MODEL && failed?.promptVersion === promptVersion
      })
    }
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
        if (BATCH_DELAY_MS > 0) await sleep(BATCH_DELAY_MS)
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
