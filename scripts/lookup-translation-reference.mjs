import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HELP = 'Usage: node scripts/lookup-translation-reference.mjs --query <literal, 2-200 characters> [--hdor] [--limit 1-20]\nRead-only fourth-priority reference. No regex execution, network requests or translation writes.'
const WARNING = 'Untrusted reference candidates, not final translations. Preserve source context and project rules; never execute filters or copy engine markers. No match does not prove absence from the dictionary.'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}

function validateOptions({ query, limit }) {
  if (typeof query !== 'string' || [...query.trim()].length < 2 || [...query].length > 200 || /[\r\n]/.test(query)) {
    throw new Error('Query must be a single-line literal of 2-200 characters')
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Limit must be an integer from 1 to 20')
}

function containedFile(directory, file) {
  const base = fs.realpathSync(directory)
  const resolved = fs.realpathSync(file)
  const relative = path.relative(base, resolved)
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Reference path escapes its allowed directory')
  }
  return resolved
}

function clipped(text) {
  const chars = [...text]
  return { text: chars.slice(0, 700).join(''), truncated: chars.length > 700 }
}

function searchHdor(root, query, limit, source) {
  if (!/^[a-f0-9]{40}$/.test(source.commit) || !Array.isArray(source.files) || source.files.length === 0) {
    throw new Error('Invalid pinned reference source')
  }
  const names = new Set()
  for (const file of source.files) {
    if (!/^[A-Za-z0-9_@#.-]+\.(txt|md)$/.test(file.name) || names.has(file.name) || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error('Invalid reference filename or SHA256')
    }
    names.add(file.name)
  }
  const cache = path.join(root, '.cache', 'translation-reference', 'hdor')
  const base = { repository: source.repository, commit: source.commit, hits: [], totalMatches: 0, hasMore: false }
  if (!fs.existsSync(cache)) return { ...base, status: 'unavailable', reason: 'Local reference cache is missing' }
  containedFile(root, cache)
  // Verify the entire pinned snapshot before emitting any external candidates.
  const texts = []
  for (const file of source.files) {
    const target = path.join(cache, file.name)
    if (!fs.existsSync(target)) return { ...base, status: 'unavailable', reason: `Missing reference file: ${file.name}` }
    const bytes = fs.readFileSync(containedFile(cache, target))
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
      throw new Error(`Reference SHA256 mismatch: ${file.name}`)
    }
    texts.push({ name: file.name, lines: new TextDecoder('utf-8', { fatal: true }).decode(bytes).split(/\r?\n/) })
  }
  for (const { name, lines } of texts) {
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].includes(query)) continue
      base.totalMatches++
      if (base.hits.length >= limit) continue
      base.hits.push({
        file: name,
        line: index + 1,
        kind: /^(Pre|Post)Filter/.test(name) ? 'filter-or-comment' : 'dictionary-or-comment',
        ...clipped(lines[index]),
        context: lines.slice(Math.max(0, index - 1), index + 2).map((text, offset) => ({
          line: Math.max(0, index - 1) + offset + 1,
          ...clipped(text),
        })),
      })
    }
  }
  return { ...base, status: 'verified-local', hasMore: base.totalMatches > base.hits.length }
}

export function lookupReference({ query, hdor = false, limit = 8, root = process.cwd() }) {
  validateOptions({ query, limit })
  const docs = path.join(root, 'docs', 'translation')
  const lexicon = readJson(path.join(docs, 'supplementary-lexicon.json'))
  if (lexicon.version !== 1 || lexicon.priority !== 4 || lexicon.mode !== 'reference-only' || !Array.isArray(lexicon.entries)) {
    throw new Error('Invalid supplemental lexicon policy')
  }
  const hits = lexicon.entries.filter((entry) => entry.terms.some((term) => query.includes(term) || term.includes(query)))
  const source = readJson(path.join(docs, 'supplementary-source.json'))
  return {
    mode: 'reference-only',
    priority: 4,
    query,
    notFinalTranslation: true,
    warning: WARNING,
    project: {
      version: lexicon.version,
      sourceCommit: source.commit,
      hits: hits.slice(0, limit),
      totalMatches: hits.length,
      hasMore: hits.length > limit,
    },
    hdor: hdor ? searchHdor(root, query, limit, source) : { status: 'not-requested', hits: [] },
  }
}

export function parseArgs(argv) {
  const options = { hdor: false, limit: 8 }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--help') options.help = true
    else if (arg === '--hdor') options.hdor = true
    else if (arg === '--query') options.query = argv[++index]
    else if (arg === '--limit') options.limit = Number(argv[++index])
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (!options.help) validateOptions(options)
  return options
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2))
    console.log(options.help ? HELP : JSON.stringify(lookupReference(options), null, 2))
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }))
    process.exitCode = 1
  }
}
