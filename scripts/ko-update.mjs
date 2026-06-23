#!/usr/bin/env node
import path from 'node:path'
import { run, parseArgs, printSummary, ROOT } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))

function nodeScript(script, extra = []) {
  run(process.execPath, [path.join(ROOT, 'scripts', script), ...extra])
}

const pass = []
if (args.dryRun) pass.push('--dry-run')
if (args.force) pass.push('--force')
if (args.scope) pass.push('--scope', args.scope)
if (args.limit != null) pass.push('--limit', String(args.limit))
if (args.file) pass.push('--file', args.file)

nodeScript('sync-upstream.mjs', args.dryRun ? ['--dry-run'] : [])
nodeScript('sync-keys.mjs', [...pass, '--remove-deleted'])
nodeScript('translate-ko.mjs', ['--changed', ...pass])
nodeScript('validate-translations.mjs', args.file ? ['--file', args.file] : ['--scope', args.scope])
if (args.dryRun) {
  printSummary('ko:update dry-run', { status: 'ok' })
  process.exit(0)
}
nodeScript('update-manifest.mjs')
nodeScript('zip-ko.mjs')
nodeScript('publish.mjs', args.noPush ? ['--no-push'] : [])

printSummary('ko:update', { status: 'ok' })
