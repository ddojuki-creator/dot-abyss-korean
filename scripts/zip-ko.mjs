#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const out = process.argv[2] || 'dotabyss-ko-translated.zip'
if (fs.existsSync(out)) fs.rmSync(out)
execFileSync('zip', ['-qr', out, 'translations'], { stdio: 'inherit' })
console.log(`created ${out}`)
