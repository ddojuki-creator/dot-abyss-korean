import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { lookupReference, parseArgs } from '../lookup-translation-reference.mjs'
import { loadPrompt } from '../lib/ko-pipeline.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DOCS = path.join(ROOT, 'docs', 'translation')
const read = (file) => fs.readFileSync(file, 'utf8')
const lexicon = JSON.parse(read(path.join(DOCS, 'supplementary-lexicon.json')))

function fixture(t, text = 'before\nなんちゃって\tcandidate\nafter\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-reference-test-'))
  t.after(() => {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(root))
    assert.ok(relative.startsWith('abyss-reference-test-') && !relative.includes(path.sep))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const docs = path.join(root, 'docs', 'translation')
  const cache = path.join(root, '.cache', 'translation-reference', 'hdor')
  fs.mkdirSync(docs, { recursive: true })
  fs.mkdirSync(cache, { recursive: true })
  const source = {
    commit: 'a'.repeat(40), repository: 'test-fixture',
    files: [{ name: 'UserDict_test.txt', sha256: crypto.createHash('sha256').update(text).digest('hex') }],
  }
  fs.copyFileSync(path.join(DOCS, 'supplementary-lexicon.json'), path.join(docs, 'supplementary-lexicon.json'))
  fs.writeFileSync(path.join(docs, 'supplementary-source.json'), JSON.stringify(source))
  fs.writeFileSync(path.join(cache, source.files[0].name), text)
  return { root, docs, cache, source }
}

test('curated entries are contextual candidates with traceable sources, not replacements', () => {
  assert.equal(lexicon.priority, 4)
  assert.equal(lexicon.mode, 'reference-only')
  assert.equal(lexicon.entries.length, 8)
  assert.equal(new Set(lexicon.entries.map((entry) => entry.id)).size, 8)
  for (const entry of lexicon.entries) {
    assert.ok(entry.terms.every((term) => typeof term === 'string' && term.length >= 2))
    assert.ok(entry.context && entry.caution && entry.options.length)
    assert.ok(entry.references.every((ref) => ref.file && Number.isInteger(ref.line) && ref.line > 0))
    assert.equal(entry.replace, undefined)
    assert.equal(entry.apply, undefined)
  }
})

test('literal project lookup returns contextual warnings and skips external reads', () => {
  const result = lookupReference({ query: 'なんちゃって', root: ROOT })
  assert.equal(result.project.hits[0].id, 'nanchatte-senses')
  assert.match(result.project.hits[0].caution, /문장 끝/)
  assert.equal(result.hdor.status, 'not-requested')
  assert.equal(result.notFinalTranslation, true)
  assert.equal(lookupReference({ query: '없는어휘123', root: ROOT }).project.hits.length, 0)
  assert.equal(lookupReference({ query: '.*', root: ROOT }).project.hits.length, 0)
  assert.match(lookupReference({ query: 'シャキッ', root: ROOT }).project.hits[0].caution, /샐러드 식감/)
})

test('optional raw lookup returns verified literal matches with line context', (t) => {
  const { root } = fixture(t)
  const result = lookupReference({ query: 'なんちゃって', hdor: true, root })
  assert.equal(result.hdor.status, 'verified-local')
  assert.equal(result.hdor.hits[0].line, 2)
  assert.equal(result.hdor.hits[0].context[0].text, 'before')
  assert.equal(result.hdor.hits[0].context[2].text, 'after')
  assert.equal(lookupReference({ query: '.*', hdor: true, root }).hdor.hits.length, 0)
})

test('missing local reference does not block curated lookup', (t) => {
  const { root, cache, source } = fixture(t)
  fs.unlinkSync(path.join(cache, source.files[0].name))
  const result = lookupReference({ query: 'なんちゃって', hdor: true, root })
  assert.equal(result.hdor.status, 'unavailable')
  assert.equal(result.project.hits.length, 1)
})

test('external lookup verifies hashes; non-hdor lookup ignores altered raw files', (t) => {
  const { root, cache, source } = fixture(t)
  fs.appendFileSync(path.join(cache, source.files[0].name), 'altered')
  assert.equal(lookupReference({ query: 'なんちゃって', root }).hdor.status, 'not-requested')
  assert.throws(() => lookupReference({ query: 'なんちゃって', hdor: true, root }), /SHA256 mismatch/)
})

test('reference filenames cannot escape local cache', (t) => {
  const { root, docs, source } = fixture(t)
  for (const name of ['../outside.txt', '..\\outside.txt', 'C:\\outside.txt']) {
    source.files[0].name = name
    fs.writeFileSync(path.join(docs, 'supplementary-source.json'), JSON.stringify(source))
    assert.throws(() => lookupReference({ query: 'なんちゃって', hdor: true, root }), /Invalid reference filename/)
  }
})

test('symlinked cache outside the project is rejected', (t) => {
  const f = fixture(t)
  const other = fixture(t)
  const moved = path.join(f.root, 'original-cache')
  fs.renameSync(f.cache, moved)
  try {
    fs.symlinkSync(other.cache, f.cache, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Symlinks unavailable on this host')
    throw error
  }
  try {
    assert.throws(() => lookupReference({ query: 'なんちゃって', hdor: true, root: f.root }), /escapes/)
  } finally {
    fs.unlinkSync(f.cache)
  }
})

test('raw results and long lines are bounded', (t) => {
  const { root } = fixture(t, ('なんちゃって' + 'x'.repeat(900) + '\n').repeat(4))
  const result = lookupReference({ query: 'なんちゃって', hdor: true, limit: 1, root })
  assert.equal(result.hdor.totalMatches, 4)
  assert.equal(result.hdor.hits.length, 1)
  assert.equal(result.hdor.hasMore, true)
  assert.equal(result.hdor.hits[0].truncated, true)
  assert.equal(result.hdor.hits[0].text.length, 700)
})

test('CLI arguments reject missing queries, regex-like expressions remain literal', () => {
  for (const args of [[], ['--query'], ['--query', 'a'], ['--query', 'aa', '--limit', '21'], ['--query', 'aa', '--limit', '1.5'], ['--write']]) {
    assert.throws(() => parseArgs(args))
  }
  assert.equal(parseArgs(['--query', '.*']).query, '.*')
  assert.equal(parseArgs(['--help']).help, true)
})

test('CLI returns JSON without changing fixture files; help and errors work', (t) => {
  const { root, docs, cache } = fixture(t)
  const files = [path.join(docs, 'supplementary-lexicon.json'), path.join(docs, 'supplementary-source.json'), path.join(cache, 'UserDict_test.txt')]
  const before = files.map(read)
  const script = path.join(ROOT, 'scripts', 'lookup-translation-reference.mjs')
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' })
  const result = run(['--query', 'なんちゃって', '--hdor'])
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).hdor.status, 'verified-local')
  assert.deepEqual(files.map(read), before)
  assert.match(run(['--help']).stdout, /Read-only/)
  assert.equal(run(['--write']).status, 1)
})

test('translation and review loaders include policy, never the full reference data', () => {
  for (const scope of ['common', 'novels']) {
    const prompt = loadPrompt(scope)
    assert.match(prompt, /--- supplementary-reference.md ---/)
    assert.match(prompt, /호출자가 필요한 조회 결과를 별도로 제공하지 않았다면/)
    assert.ok(!prompt.includes('"id": "nanchatte-senses"'))
  }
  for (const script of ['review-context.mjs', 'review-dialogue-openai.mjs', 'verify-dialogue-suggestions-openai.mjs']) {
    const source = read(path.join(ROOT, 'scripts', script))
    assert.match(source, /['"](?:docs\/translation\/)?supplementary-reference\.md['"]/)
    assert.doesNotMatch(source, /supplementary-lexicon\.json|PreFilter_@Hdor/)
  }
})
