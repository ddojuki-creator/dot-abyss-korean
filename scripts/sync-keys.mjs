#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { isPlainObject, koFileForUpstreamFile, listUpstreamTranslationFiles, parseArgs, printSummary, readJson, rel, shapeFromSource, toPosix, upstreamTranslationDir, writeJson } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))
if (!fs.existsSync(upstreamTranslationDir())) {
  throw new Error('Upstream translations not found. Run npm run sync:upstream first.')
}

let files = listUpstreamTranslationFiles()
if (args.scope === 'common') files = files.filter((file) => !toPosix(file).includes('/translations/novels/'))
if (args.scope === 'novels') files = files.filter((file) => toPosix(file).includes('/translations/novels/'))
if (args.file) {
  const relative = args.file.replace(/ko_KR\.json$/, 'zh_Hans.json')
  files = [path.join(process.cwd(), '.cache', 'upstream', relative)]
}
if (args.limit != null) files = files.slice(0, args.limit)

let created = 0
let updated = 0
let addedKeys = 0
let removedKeys = 0
const removedSamples = []

for (const upstreamFile of files) {
  if (!fs.existsSync(upstreamFile)) continue
  const source = readJson(upstreamFile)
  if (!isPlainObject(source)) throw new Error(`Upstream file is not a JSON object: ${upstreamFile}`)
  const targetFile = koFileForUpstreamFile(upstreamFile)
  const existed = fs.existsSync(targetFile)
  const oldTarget = existed ? readJson(targetFile) : {}
  const { data, added, removed } = shapeFromSource(source, oldTarget, { removeDeleted: args.force || args.removeDeleted })
  addedKeys += added.length
  removedKeys += removed.length
  if (removed.length) removedSamples.push(`${rel(targetFile)}: ${removed.slice(0, 5).join(', ')}`)

  if (args.dryRun) {
    console.log(`${existed ? 'sync' : 'create'} ${rel(targetFile)} added=${added.length} removed=${removed.length}`)
    continue
  }
  writeJson(targetFile, data)
  if (existed) updated += 1
  else created += 1
}

printSummary('sync:keys', {
  files: files.length,
  created,
  updated,
  addedKeys,
  removedKeys,
  deletedPolicy: args.force || args.removeDeleted ? 'removed' : 'kept-and-reported',
})

if (removedSamples.length) {
  console.log('\nRemoved-key samples:')
  for (const sample of removedSamples.slice(0, 20)) console.log(`- ${sample}`)
}
