import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export const ROOT = process.cwd()
export const TRANSLATIONS_DIR = path.join(ROOT, 'translations')
export const CACHE_DIR = path.join(ROOT, '.cache')
export const UPSTREAM_DIR = path.join(CACHE_DIR, 'upstream')
export const STATE_FILE = path.join(ROOT, '.translate-ko-state.json')
export const KO = 'ko_KR'
export const ZH = 'zh_Hans'
export const MANIFEST_REL = `translations/manifest/${KO}.json`
export const UPSTREAM_REPO = 'https://github.com/anosu/dotabyss-translation.git'
export const KOREAN_REPO = 'https://github.com/ddojuki-creator/dot-abyss-korean.git'

export function parseArgs(argv, defaults = {}) {
  const args = {
    dryRun: false,
    noPush: false,
    scope: 'all',
    limit: null,
    file: null,
    force: false,
    changed: false,
    dir: null,
    removeDeleted: false,
    ...defaults,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`)
      return argv[++i]
    }
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--no-push') args.noPush = true
    else if (a === '--force') args.force = true
    else if (a === '--changed') args.changed = true
    else if (a === '--remove-deleted') args.removeDeleted = true
    else if (a === '--scope') args.scope = next()
    else if (a.startsWith('--scope=')) args.scope = a.slice('--scope='.length)
    else if (a === '--limit') args.limit = Number(next())
    else if (a.startsWith('--limit=')) args.limit = Number(a.slice('--limit='.length))
    else if (a === '--file') args.file = next()
    else if (a.startsWith('--file=')) args.file = a.slice('--file='.length)
    else if (a === '--dir') args.dir = next()
    else if (a.startsWith('--dir=')) args.dir = a.slice('--dir='.length)
    else if (a === '--help' || a === '-h') args.help = true
    else throw new Error(`Unknown argument: ${a}`)
  }
  if (!['common', 'novels', 'all'].includes(args.scope)) {
    throw new Error(`Invalid --scope: ${args.scope}`)
  }
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 0)) {
    throw new Error(`Invalid --limit: ${args.limit}`)
  }
  return args
}

export function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

export function absFromRoot(file) {
  return path.resolve(ROOT, file)
}

export function toPosix(file) {
  return file.split(path.sep).join('/')
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8')
}

export function readJson(file) {
  return JSON.parse(readText(file))
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, `${JSON.stringify(data, null, 4)}\n`, 'utf8')
}

export function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) files.push(...walk(full))
    else files.push(full)
  }
  return files
}

export function isKoJson(file) {
  return toPosix(file).endsWith(`/${KO}.json`)
}

export function isZhJson(file) {
  return toPosix(file).endsWith(`/${ZH}.json`)
}

export function isManifest(file) {
  return toPosix(path.resolve(file)).endsWith(`translations/manifest/${KO}.json`)
}

export function isUpstreamManifest(file) {
  return toPosix(path.resolve(file)).endsWith(`translations/manifest/${ZH}.json`)
}

export function upstreamTranslationDir() {
  return path.join(UPSTREAM_DIR, 'translations')
}

export function upstreamFileForKoFile(koFile) {
  const relative = rel(koFile).replaceAll('/', path.sep)
  return path.join(UPSTREAM_DIR, relative.replace(`${path.sep}${KO}.json`, `${path.sep}${ZH}.json`))
}

export function koFileForUpstreamFile(zhFile) {
  const relative = path.relative(UPSTREAM_DIR, zhFile)
  return path.join(ROOT, relative.replace(`${path.sep}${ZH}.json`, `${path.sep}${KO}.json`))
}

export function getTargetFiles(args) {
  if (args.file) {
    const file = absFromRoot(args.file)
    if (!fs.existsSync(file)) throw new Error(`File not found: ${args.file}`)
    if (!isKoJson(file)) throw new Error(`Not a ${KO}.json file: ${args.file}`)
    if (isManifest(file)) throw new Error(`${MANIFEST_REL} is generated and excluded`)
    return [file]
  }

  let files = []
  if (args.scope === 'common') {
    for (const type of ['names', 'titles', 'descriptions', 'another_name']) {
      const file = path.join(TRANSLATIONS_DIR, type, `${KO}.json`)
      if (fs.existsSync(file)) files.push(file)
    }
  } else if (args.scope === 'novels') {
    files = walk(path.join(TRANSLATIONS_DIR, 'novels')).filter(isKoJson).sort()
  } else {
    files = walk(TRANSLATIONS_DIR).filter(isKoJson).filter((file) => !isManifest(file)).sort()
  }
  if (args.limit != null) files = files.slice(0, args.limit)
  return files
}

export function listUpstreamTranslationFiles() {
  return walk(upstreamTranslationDir())
    .filter(isZhJson)
    .filter((file) => !isUpstreamManifest(file))
    .sort()
}

export function collectEntries(data, prefix = []) {
  const out = []
  if (!isPlainObject(data)) return out
  for (const [key, value] of Object.entries(data)) {
    const p = [...prefix, key]
    if (typeof value === 'string') out.push({ path: p, key, value })
    else if (isPlainObject(value)) out.push(...collectEntries(value, p))
    else out.push({ path: p, key, value })
  }
  return out
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function getByPath(obj, p) {
  let cur = obj
  for (const part of p) {
    if (!isPlainObject(cur) && typeof cur !== 'object') return undefined
    cur = cur?.[part]
  }
  return cur
}

export function setByPath(obj, p, value) {
  let cur = obj
  for (let i = 0; i < p.length - 1; i++) cur = cur[p[i]]
  cur[p[p.length - 1]] = value
}

export function shapeFromSource(source, oldTarget = {}, options = {}) {
  const added = []
  const removed = []
  function build(src, old, pointer = []) {
    const out = {}
    for (const [key, srcValue] of Object.entries(src)) {
      const p = [...pointer, key]
      const oldValue = old?.[key]
      if (isPlainObject(srcValue)) out[key] = build(srcValue, isPlainObject(oldValue) ? oldValue : {}, p)
      else if (typeof oldValue === 'string') out[key] = oldValue
      else {
        out[key] = key
        added.push(p.join(' > '))
      }
    }
    if (isPlainObject(old)) {
      for (const key of Object.keys(old)) {
        if (!(key in src)) removed.push([...pointer, key].join(' > '))
      }
    }
    if (!options.removeDeleted && isPlainObject(old)) {
      for (const [key, value] of Object.entries(old)) {
        if (!(key in src)) out[key] = value
      }
    }
    return out
  }
  return { data: build(source, oldTarget), added, removed }
}

// Exclude Japanese punctuation such as the middle dot (・), which is also used in Korean names.
const japaneseRe = /[\u3041-\u3096\u30a1-\u30fa\u30fd-\u30ff]/
const koreanRe = /[\uac00-\ud7a3]/
const cjkRe = /[\u3400-\u9fff]/

export function looksKorean(value) {
  const text = value.replace(/<[^>]*>/g, '')
  return koreanRe.test(text) && !japaneseRe.test(text)
}

export function shouldTranslateValue(key, value, options = {}) {
  if (typeof value !== 'string') return false
  if (value.trim() === '') return false
  if (options.force) return true
  const text = value.replace(/<[^>]*>/g, '')
  if (looksKorean(value)) return false
  if (value === key) return japaneseRe.test(text) || cjkRe.test(text)
  return japaneseRe.test(text) || cjkRe.test(text)
}

export function extractProtectedTokens(value) {
  if (typeof value !== 'string') return []
  const patterns = [
    /<\/?(?:br|user|color|size|sprite|font|b|i|u|s|mark|mspace|voffset|align|alpha|cspace|indent|line-height|line-indent|link|lowercase|uppercase|smallcaps|margin|noparse|nobr|page|pos|rotate|space|style|sub|sup|width)(?:\s+[^>]*)?>/gi,
    /%[A-Za-z0-9_]+%/g,
    /%[sdif]/g,
    /\{[A-Za-z0-9_]+\}/g,
    /\{[0-9]+\}/g,
    /\[[A-Za-z0-9_]+\]/g,
    /\\[nrt]/g,
  ]
  const out = []
  for (const re of patterns) {
    for (const match of value.matchAll(re)) out.push(match[0])
  }
  return out
}

export function countValues(values) {
  const map = new Map()
  for (const value of values) map.set(value, (map.get(value) || 0) + 1)
  return map
}

export function compareProtectedTokens(source, target) {
  const a = countValues(extractProtectedTokens(source))
  const b = countValues(extractProtectedTokens(target))
  const errors = []
  for (const [token, count] of a) {
    const actual = b.get(token) || 0
    const isLineBreak = /^<br(?:\s+[^>]*)?>$/i.test(token) || /^\\[nr]$/.test(token)
    if (!isLineBreak && actual !== count) {
      errors.push(`${token}: source=${count} target=${actual}`)
    }
  }
  const lineBreakPattern = /<br(?:\s+[^>]*)?>|\\r\\n|\\[nr]|\r\n|\r|\n/gi
  const sourceBreaks = source.match(lineBreakPattern)?.length || 0
  const targetBreaks = target.match(lineBreakPattern)?.length || 0
  if (targetBreaks > sourceBreaks) {
    errors.push(`line-breaks: source=${sourceBreaks} target=${targetBreaks}, max=${sourceBreaks}`)
  }
  return errors
}

export function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex')
}

export function stableHash(value) {
  return sha1(JSON.stringify(value))
}

export function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { version: 1, items: {}, failed: {} }
  try {
    const state = JSON.parse(readText(STATE_FILE))
    state.items ||= {}
    state.failed ||= {}
    return state
  } catch {
    return { version: 1, items: {}, failed: {} }
  }
}

export function saveState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function readPromptVersion() {
  const file = path.join(ROOT, 'docs', 'translation', 'prompt-version.txt')
  return fs.existsSync(file) ? readText(file).trim() : 'unversioned'
}

export function loadPrompt(scope) {
  const docs = ['style-core.md', 'tags-placeholders.md', 'glossary.md', 'forbidden.md']
  if (scope === 'common') docs.splice(1, 0, 'ui-system.md')
  else docs.splice(1, 0, 'character-voice.md', 'character-cards.md', 'adult-content.md')

  const docText = docs
    .map((name) => {
      const file = path.join(ROOT, 'docs', 'translation', name)
      return fs.existsSync(file) ? `\n\n--- ${name} ---\n${readText(file)}` : ''
    })
    .join('')
  const promptFile = path.join(ROOT, 'scripts', 'prompts', scope === 'common' ? 'common.md' : 'novels.md')
  const taskText = fs.existsSync(promptFile) ? readText(promptFile) : ''
  return `${taskText}\n${docText}`.trim()
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: options.stdio || 'inherit', shell: false })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
  return result
}

export function git(args, options = {}) {
  return run('git', ['-c', `safe.directory=${ROOT}`, ...args], options)
}

export function hasGitChanges() {
  const result = spawnSync('git', ['-c', `safe.directory=${ROOT}`, 'status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr || 'git status failed')
  return result.stdout.trim().length > 0
}

export function printSummary(title, rows) {
  console.log(`\n${title}`)
  for (const [key, value] of Object.entries(rows)) console.log(`${key}=${value}`)
}
