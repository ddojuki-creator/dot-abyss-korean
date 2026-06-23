#!/usr/bin/env node
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const out = process.argv[2] || 'dotabyss-ko-translated.zip'
if (fs.existsSync(out)) fs.rmSync(out, { force: true })

let result
if (process.platform === 'win32') {
  result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -LiteralPath translations -DestinationPath ${JSON.stringify(out)} -Force`,
  ], { stdio: 'inherit' })
} else {
  result = spawnSync('zip', ['-qr', out, 'translations'], { stdio: 'inherit' })
}

if (result.status !== 0) process.exit(result.status || 1)
console.log(`created ${out}`)
