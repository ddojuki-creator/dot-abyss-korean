#!/usr/bin/env node
import fs from 'node:fs'
import { CACHE_DIR, UPSTREAM_DIR, UPSTREAM_REPO, ensureDir, parseArgs, printSummary, run } from './lib/ko-pipeline.mjs'

const args = parseArgs(process.argv.slice(2))
ensureDir(CACHE_DIR)

if (args.dryRun) {
  printSummary('sync:upstream dry-run', {
    repo: UPSTREAM_REPO,
    dir: UPSTREAM_DIR,
    action: fs.existsSync(UPSTREAM_DIR) ? 'pull' : 'clone',
  })
  process.exit(0)
}

if (fs.existsSync(UPSTREAM_DIR)) {
  run('git', ['-c', `safe.directory=${UPSTREAM_DIR}`, '-C', UPSTREAM_DIR, 'pull', '--ff-only'])
} else {
  run('git', ['-c', 'http.sslVerify=false', 'clone', UPSTREAM_REPO, UPSTREAM_DIR])
}

printSummary('sync:upstream', { dir: UPSTREAM_DIR, status: 'ok' })
