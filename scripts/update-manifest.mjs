import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const separator = '\0'
const pathSeparator = '\x01'
const translationDir = 'translations'
const languages = ['ko_KR']
const contentTypes = ['names', 'titles', 'descriptions', 'another_name']

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

function fileHash(file) {
    return objectHash(JSON.parse(fs.readFileSync(file, 'utf8')))
}

function buildManifest(language) {
    const manifest = {}

    for (const type of contentTypes) {
        const file = path.join(translationDir, type, `${language}.json`)
        if (fs.existsSync(file)) {
            manifest[type] = fileHash(file)
        }
    }

    const novelsDir = path.join(translationDir, 'novels')
    manifest.novels = {}
    for (const novelId of fs.readdirSync(novelsDir).sort()) {
        const file = path.join(novelsDir, novelId, `${language}.json`)
        if (fs.existsSync(file)) {
            manifest.novels[novelId] = fileHash(file)
        }
    }

    manifest.hash = objectHash(manifest)
    return manifest
}

fs.mkdirSync(path.join(translationDir, 'manifest'), { recursive: true })

for (const language of languages) {
    const manifest = buildManifest(language)
    const output = path.join(translationDir, 'manifest', `${language}.json`)
    fs.writeFileSync(output, `${JSON.stringify(manifest, null, 4)}\n`, 'utf8')
    console.log(`${language}: novels=${Object.keys(manifest.novels).length}`)
}
