import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const GUIDES = ['README.md', 'final-review.md', 'direct-review.md', 'style-core.md', 'glossary.md', 'character-cards.md', 'character-voice.md', 'context-review.md', 'adult-content.md', 'tags-placeholders.md', 'forbidden.md', 'qa-checklist.md', 'supplementary-reference.md', 'supplementary-lexicon.json', 'supplementary-source.json']
export const sha = (value) => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex')

export function immutableJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const text = JSON.stringify(data, null, 2) + '\n'
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== text) throw new Error(`Refusing to overwrite ${file}`)
    return
  }
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temporary, text, { flag: 'wx' })
  // Publish a fully written immutable artifact without replacing a concurrent writer.
  try { fs.linkSync(temporary, file) } finally { fs.unlinkSync(temporary) }
}

export function guides() {
  return Object.fromEntries(GUIDES.map((name) => [name, sha(fs.readFileSync(path.join(process.cwd(), 'docs/translation', name)))]))
}
