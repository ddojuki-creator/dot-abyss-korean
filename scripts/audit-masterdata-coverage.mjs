import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const masterPath =
    process.env.ABYSSMOD_MASTER_JSON ??
    path.resolve(root, '..', 'AbyssMod-main-newversion', 'AbyssMod', 'Config', 'master.json')
const staticPath = path.join(root, 'translations', 'static', 'ko_KR.json')
const missingPath = path.join(root, 'translations', 'static', 'ko_KR.missing.json')

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const master = readJson(masterPath)
const bundle = readJson(staticPath)
const missing = fs.existsSync(missingPath) ? readJson(missingPath) : {}

const warnings = []
for (const [table, rule] of Object.entries(master.tables ?? {})) {
    const configuredFields = Object.keys(rule).filter((field) => !field.startsWith('_') && rule[field])
    for (const field of configuredFields) {
        const count = Object.keys(bundle[table]?.[field] ?? {}).length
        if (count === 0) warnings.push(`${table}.${field}: no translated static entries`)
    }
}

const missingCount = Object.values(missing).flatMap((fields) => Object.values(fields)).reduce(
    (sum, list) => sum + list.length,
    0,
)

if (warnings.length > 0) {
    console.warn(`coverage warnings=${warnings.length}`)
    for (const warning of warnings.slice(0, 80)) console.warn(warning)
}

console.log(`masterdata coverage audit complete: missingCandidates=${missingCount}`)
