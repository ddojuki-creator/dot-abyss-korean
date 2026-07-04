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
    'outgame',
    'ability_descriptions',
]

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`, 'utf8')
}

function isJapaneseLike(value) {
    return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value)
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
            merged.set(key, value)
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
