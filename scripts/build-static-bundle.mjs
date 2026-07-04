import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const masterPath =
    process.env.ABYSSMOD_MASTER_JSON ??
    path.resolve(root, '..', 'AbyssMod-main-newversion', 'AbyssMod', 'Config', 'master.json')
const snapshotPath = path.join(root, 'snapshots', 'game-cache-ja_JP.json')
const outputPath = path.join(root, 'translations', 'static', 'ko_KR.json')
const reportPath = path.join(root, 'translations', 'static', 'ko_KR.missing.json')
const writeMissingSource = process.argv.includes('--write-missing-source')

const legacyTypes = [
    'names',
    'titles',
    'descriptions',
    'another_name',
    'ability_descriptions',
    'outgame',
]

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`, 'utf8')
}

function isJapaneseLike(value) {
    if (/[가-힣]/u.test(value)) return false
    return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value)
}

function colorSealTerms(value) {
    const passionToken = '\u0000PASSION_SEAL\u0000'
    const shockToken = '\u0000SHOCK_SEAL\u0000'
    return value
        .replace(/<color=#ff5050>\s*문장\s*[:：]\s*열정\s*<\/color>/giu, passionToken)
        .replace(/<color=#6b8cff>\s*문장\s*[:：]\s*충격\s*<\/color>/giu, shockToken)
        .replace(/문장\s*[:：]\s*열정/gu, passionToken)
        .replace(/문장\s*[:：]\s*충격/gu, shockToken)
        .replace(/紋章\s*[:：]\s*情熱/gu, passionToken)
        .replace(/紋章\s*[:：]\s*衝撃/gu, shockToken)
        .replaceAll(passionToken, '<color=#FF5050>문장: 열정</color>')
        .replaceAll(shockToken, '<color=#6B8CFF>문장: 충격</color>')
}

function collectLegacyTranslations() {
    const merged = new Map()
    for (const type of legacyTypes) {
        const file = path.join(root, 'translations', type, 'ko_KR.json')
        if (!fs.existsSync(file)) continue

        const dict = readJson(file)
        for (const [key, value] of Object.entries(dict)) {
            if (typeof value !== 'string' || value.length === 0) continue
            if (isJapaneseLike(value) && !writeMissingSource) continue
            merged.set(key, colorSealTerms(value))
        }
    }
    return merged
}

function collectSnapshotByTable(snapshot) {
    const entries = snapshot.entries ?? snapshot
    const byTable = new Map()
    for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== 'string' || value.length === 0) continue
        const [table] = key.split('/')
        if (!table?.startsWith('m_')) continue
        if (!byTable.has(table)) byTable.set(table, new Set())
        byTable.get(table).add(value)
    }
    return byTable
}

const master = readJson(masterPath)
const snapshot = readJson(snapshotPath)
const translations = collectLegacyTranslations()
const sourceByTable = collectSnapshotByTable(snapshot)
const bundle = {}
const missing = {}

for (const [table, rule] of Object.entries(master.tables ?? {})) {
    const fields = Object.keys(rule).filter((field) => !field.startsWith('_') && rule[field])
    const sourceValues = [...(sourceByTable.get(table) ?? [])].sort()
    if (fields.length === 0 || sourceValues.length === 0) continue

    for (const field of fields) {
        const fieldBundle = {}
        const fieldMissing = []

        for (const source of sourceValues) {
            const translated = translations.get(source)
            if (translated) {
                fieldBundle[source] = translated
            } else if (writeMissingSource) {
                fieldBundle[source] = source
            } else {
                fieldMissing.push(source)
            }
        }

        if (Object.keys(fieldBundle).length > 0) {
            bundle[table] ??= {}
            bundle[table][field] = fieldBundle
        }

        if (fieldMissing.length > 0) {
            missing[table] ??= {}
            missing[table][field] = fieldMissing
        }
    }
}

writeJson(outputPath, bundle)
writeJson(reportPath, missing)

const tableCount = Object.keys(bundle).length
const entryCount = Object.values(bundle).flatMap((fields) => Object.values(fields)).reduce(
    (sum, dict) => sum + Object.keys(dict).length,
    0,
)
const missingCount = Object.values(missing).flatMap((fields) => Object.values(fields)).reduce(
    (sum, list) => sum + list.length,
    0,
)

console.log(`static bundle: tables=${tableCount}, entries=${entryCount}, missing=${missingCount}`)
