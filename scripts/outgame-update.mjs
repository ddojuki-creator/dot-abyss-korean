#!/usr/bin/env node
import path from 'node:path'
import { parseArgs, printSummary, ROOT, run } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))
const cacheIndex = process.argv.indexOf('--cache')
const cacheArgs = cacheIndex >= 0 ? ['--cache', process.argv[cacheIndex + 1]] : []

function nodeScript(script, extra = []) {
  run(process.execPath, [path.join(ROOT, 'scripts', script), ...extra])
}

nodeScript('extract-game-cache.mjs', [...cacheArgs, ...(args.dryRun ? ['--dry-run'] : [])])
nodeScript('translate-ko.mjs', [
  '--file', 'translations/outgame/ko_KR.json',
  '--scope', 'common',
  ...(args.dryRun ? ['--dry-run'] : []),
])
if (!args.dryRun) nodeScript('normalize-terminology.mjs')
nodeScript('validate-translations.mjs', ['--file', 'translations/outgame/ko_KR.json'])

if (!args.dryRun) nodeScript('update-manifest.mjs')
printSummary(args.dryRun ? 'outgame:update dry-run' : 'outgame:update', { status: 'ok' })
