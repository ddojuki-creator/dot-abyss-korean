import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const separator = '\0'
const pathSeparator = '\x01'
const root = process.cwd()
const staticPath = path.join(root, 'translations', 'static', 'ko_KR.json')
const outgamePath = path.join(root, 'translations', 'outgame', 'ko_KR.json')
const manifestPath = path.join(root, 'translations', 'manifest', 'ko_KR.json')

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function traverse(obj, prefix = '') {
    const entries = []
    for (const key of Object.keys(obj).sort()) {
        const value = obj[key]
        const currentPath = prefix ? `${prefix}${pathSeparator}${key}` : key
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            entries.push(...traverse(value, currentPath))
        } else {
            entries.push([currentPath, String(value)])
        }
    }
    return entries
}

function objectHash(obj) {
    const md5 = crypto.createHash('md5')
    for (const [key, value] of traverse(obj)) {
        md5.update(key, 'utf8')
        md5.update(separator, 'utf8')
        md5.update(value, 'utf8')
        md5.update(separator, 'utf8')
    }
    return md5.digest('hex')
}

const bundle = readJson(staticPath)
const outgame = readJson(outgamePath)
const manifest = readJson(manifestPath)
const errors = []

if (!manifest.static) errors.push('manifest is missing static hash')
if (manifest.static && manifest.static !== objectHash(bundle)) {
    errors.push(`static hash mismatch: manifest=${manifest.static}, actual=${objectHash(bundle)}`)
}

for (const required of [
    ['m_ability_details', 'description'],
    ['m_ability_details', 'awake_description'],
    ['m_character_action_skills', 'name'],
    ['m_character_action_skills', 'description'],
]) {
    const [table, field] = required
    if (!bundle[table]?.[field] || Object.keys(bundle[table][field]).length === 0) {
        errors.push(`missing required static table field: ${table}.${field}`)
    }
}

const japaneseValues = []
for (const [table, fields] of Object.entries(bundle)) {
    for (const [field, dict] of Object.entries(fields)) {
        for (const [source, translated] of Object.entries(dict)) {
            if (/[\u3040-\u30ff]/u.test(translated)) {
                japaneseValues.push(`${table}.${field}: ${source}`)
                if (japaneseValues.length >= 20) break
            }
        }
    }
}
if (japaneseValues.length > 0) {
    errors.push(`static bundle has Japanese-looking values:\n${japaneseValues.join('\n')}`)
}

const outgameConflicts = []
let outgameOverlapCount = 0
for (const [table, fields] of Object.entries(bundle)) {
    for (const [field, dict] of Object.entries(fields)) {
        for (const [source, translated] of Object.entries(dict)) {
            if (!Object.hasOwn(outgame, source)) continue
            outgameOverlapCount += 1
            if (String(outgame[source]) !== String(translated)) {
                outgameConflicts.push(`${table}.${field}: ${source}`)
                if (outgameConflicts.length >= 20) break
            }
        }
        if (outgameConflicts.length >= 20) break
    }
    if (outgameConflicts.length >= 20) break
}
if (outgameConflicts.length > 0) {
    errors.push(`static/outgame value conflicts:\n${outgameConflicts.join('\n')}`)
}

if (errors.length > 0) {
    console.error(errors.join('\n'))
    process.exit(1)
}

console.log(`static bundle audit ok: tables=${Object.keys(bundle).length}, outgameOverlaps=${outgameOverlapCount}`)
