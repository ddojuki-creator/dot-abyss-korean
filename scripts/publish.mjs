#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { git, hasGitChanges, parseArgs, printSummary, run, ROOT } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))

function nodeScript(name) {
  run(process.execPath, [path.join(ROOT, 'scripts', name)])
}

if (args.dryRun) {
  const status = spawnSync('git', ['status', '--short'], { encoding: 'utf8' })
  console.log(status.stdout)
  printSummary('publish dry-run', { noPush: args.noPush })
  process.exit(0)
}

nodeScript('validate-translations.mjs')
nodeScript('update-manifest.mjs')
nodeScript('validate-translations.mjs')

if (!hasGitChanges()) {
  printSummary('publish', { status: 'no changes' })
  process.exit(0)
}

git(['add', 'translations', 'snapshots', 'docs/translation', 'scripts', 'package.json', '.gitignore'])
git(['commit', '-m', 'Update Korean translations'])
if (!args.noPush) git(['push'])

printSummary('publish', { pushed: !args.noPush })
