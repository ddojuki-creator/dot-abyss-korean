#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import { canonicalTerminologyProblems } from './lib/canonical-terminology.mjs'

// Verified m_character_profiles row slots; only observed snapshot locations count.
export const PROFILE_FIELDS = Object.freeze({
  '2': 'flavor_text',
  '3': 'another_name',
  '4': 'profile_like',
  '5': 'profile_dislike',
  '7': 'catchphrase',
})
export const UI_LOOKUP_ORDER = Object.freeze(['outgame', 'names', 'titles', 'descriptions', 'local'])
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key)
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const digest = value => crypto.createHash('sha256').update(value).digest('hex')

export function parseArgs(argv) {
  const args = { root: process.cwd(), snapshot: 'snapshots/game-cache-ja_JP.json', all: false, requireGame: false }
  const valued = new Map([['--root', 'root'], ['--snapshot', 'snapshot'], ['--profile-ids', 'profileIds'], ['--game-root', 'gameRoot'], ['--json-out', 'jsonOut']])
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]
    const equal = raw.indexOf('=')
    const flag = equal < 0 ? raw : raw.slice(0, equal)
    if (valued.has(flag)) {
      const value = equal < 0 ? argv[++i] : raw.slice(equal + 1)
      if (typeof value !== 'string' || !value.trim() || value.startsWith('--')) throw new Error(`${flag} needs a non-empty value`)
      args[valued.get(flag)] = value
    } else if (raw === '--all') args.all = true
    else if (raw === '--require-game') args.requireGame = true
    else if (raw === '--help' || raw === '-h') args.help = true
    else throw new Error(`Unknown argument: ${raw}`)
  }
  if (args.help) return args
  args.profileIds = normalizeIds(args.profileIds)
  if (args.all === (args.profileIds.length > 0)) throw new Error('Select exactly one of --profile-ids <ids> or --all')
  if (args.requireGame && !args.gameRoot) throw new Error('--require-game needs --game-root (the BepInEx directory)')
  return args
}

function normalizeIds(value) {
  if (value === undefined || value === null) return []
  if (Array.isArray(value) && value.length === 0) return []
  const values = (Array.isArray(value) ? value : String(value).split(',')).map(s => String(s).trim())
  if (!values.length || values.some(id => !/^[1-9]\d*$/.test(id))) throw new Error('Profile IDs must be a non-empty list of positive numeric IDs')
  return [...new Set(values)]
}

export function selectProfileSources(snapshot, { profileIds, all = false } = {}) {
  if (!isObject(snapshot) || !isObject(snapshot.entries)) throw new Error('Snapshot must contain an entries object')
  const ids = normalizeIds(profileIds)
  if (all === (ids.length > 0)) throw new Error('Select exactly one of profileIds or all')
  const known = new Set()
  const observed = []
  const blankLocations = []
  for (const [location, source] of Object.entries(snapshot.entries)) {
    const match = location.match(/^m_character_profiles\/id:([1-9]\d*)\/(\d+)$/)
    if (!match) continue
    known.add(match[1])
    const field = PROFILE_FIELDS[match[2]]
    if (!field || (!all && !ids.includes(match[1]))) continue
    if (typeof source !== 'string') throw new Error(`Non-string profile source at ${location}`)
    if (!source.trim()) { blankLocations.push(location); continue }
    observed.push({ location, profileId: match[1], slot: match[2], field, source })
  }
  const unknown = ids.filter(id => !known.has(id))
  if (unknown.length) throw new Error(`Profile IDs absent from snapshot: ${unknown.join(',')}`)
  const emptyIds = ids.filter(id => !observed.some(row => row.profileId === id))
  if (emptyIds.length) throw new Error(`Profile IDs have no non-empty mapped strings: ${emptyIds.join(',')}`)
  if (!observed.length) throw new Error('No non-empty supported profile source locations selected')
  observed.sort((a, b) => Number(a.profileId) - Number(b.profileId) || Number(a.slot) - Number(b.slot))
  return { rows: observed, blankLocations, selectedProfileIds: [...new Set(observed.map(row => row.profileId))] }
}

export function translationState(dictionary, source) {
  if (!owns(dictionary, source)) return { status: 'missing', present: false }
  const value = dictionary[source]
  if (typeof value !== 'string') return { status: 'invalid-value', present: true, value }
  if (!value.trim()) return { status: 'empty', present: true, value }
  if (value === source) return { status: 'untranslated', present: true, value }
  const plain = value.replace(/<[^>]*>/g, '')
  // Include half-width kana and untranslated Han text; shared punctuation and tag attributes remain valid.
  if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(plain)) return { status: 'japanese-remaining', present: true, value }
  const terminologyProblems = canonicalTerminologyProblems(source, value)
  if (terminologyProblems.length) return { status: 'canonical-terminology', present: true, value, terminologyProblems }
  return { status: 'translated', present: true, value }
}

export function effectiveUiValue(game, source) {
  // Presence is decisive: an untranslated/empty higher layer shadows a ready local value.
  for (const layer of UI_LOOKUP_ORDER) {
    const state = translationState(game?.[layer], source)
    if (state.present) return { ...state, layer }
  }
  return { status: 'missing', present: false, layer: null }
}

export function auditProfileCoverage({ snapshot, profileIds, all = false, repo = {}, game = null, requireGame = false }) {
  if (requireGame && !game) throw new Error('requireGame needs loaded game dictionaries')
  const selection = selectProfileSources(snapshot, { profileIds, all })
  const findings = []
  const rows = []
  const byField = Object.fromEntries(Object.values(PROFILE_FIELDS).map(field => [field, { sourceLocations: 0, repoCoveredLocations: 0 }]))
  const gameStatic = { inspected: game !== null, coveredLocations: 0, missingLocations: 0, mismatchedLocations: 0 }
  let covered = 0
  let effectiveCovered = 0
  for (const sourceRow of selection.rows) {
    const { location, source, field } = sourceRow
    const primaryLayer = field === 'another_name' ? 'another_name' : 'descriptions'
    const primary = translationState(repo[primaryLayer], source)
    const outgame = translationState(repo.outgame, source)
    const staticValue = translationState(repo.static?.m_character_profiles?.[field], source)
    const row = { ...sourceRow, primaryLayer, repo: { primary, outgame, static: staticValue } }
    let repoReady = true
    for (const [layer, state] of [[primaryLayer, primary], ['outgame', outgame], [`static.m_character_profiles.${field}`, staticValue]]) {
      if (state.status !== 'translated') {
        repoReady = false
        findings.push({ scope: 'repo', severity: 'error', code: state.status, location, field, layer })
      }
    }
    if (primary.status === 'translated') {
      for (const [layer, state] of [['outgame', outgame], [`static.m_character_profiles.${field}`, staticValue]]) {
        if (state.status === 'translated' && state.value !== primary.value) {
          repoReady = false
          findings.push({ scope: 'repo', severity: 'error', code: 'value-mismatch', location, field, layer, referenceLayer: primaryLayer })
        }
      }
    }
    row.repo.covered = repoReady
    if (repoReady) covered++
    byField[field].sourceLocations++
    if (repoReady) byField[field].repoCoveredLocations++
    if (game !== null) {
      const effective = effectiveUiValue(game, source)
      const referenceMatches = primary.status === 'translated' && effective.status === 'translated' && effective.value === primary.value
      row.game = { effective: { ...effective, matchesRepoValue: referenceMatches }, static: translationState(game.static?.m_character_profiles?.[field], source) }
      if (referenceMatches) effectiveCovered++
      else findings.push({ scope: 'game-ui', severity: requireGame ? 'error' : 'warning', code: effective.status === 'translated' ? 'value-mismatch' : effective.status, location, field, layer: effective.layer, referenceLayer: primaryLayer })
      if (row.game.static.status === 'translated') {
        gameStatic.coveredLocations++
        if (primary.status === 'translated' && row.game.static.value !== primary.value) gameStatic.mismatchedLocations++
      } else gameStatic.missingLocations++
    }
    rows.push(row)
  }
  return {
    kind: 'character-profile-source-coverage',
    ok: findings.every(finding => finding.severity !== 'error'),
    selection: { mode: all ? 'all-observed-profile-strings' : 'explicit-profile-ids', profileIds: selection.selectedProfileIds, blankLocations: selection.blankLocations },
    counts: { sourceLocations: rows.length, uniqueSourceStrings: new Set(rows.map(row => row.source)).size, repoCoverageSlots: rows.length * 3, repoCoveredLocations: covered, gameUiCoveredLocations: game !== null ? effectiveCovered : null },
    byField, gameStatic, requireGame,
    gameUiLookupOrder: UI_LOOKUP_ORDER,
    findings, rows,
    limitations: [
      'This string-only snapshot audit cannot verify numeric profile-ID to character-ID relationships or the complete inventory of empty fields and placeholder/dummy rows. A separate verified raw-row inventory is required.',
      'Only the five mapped fields actually observed in the snapshot are source locations. Extra static copies are coverage paths, not additional source locations.',
      'Coverage, exact-value checks and the shared fixed-term diagnostic do not approve full meaning, character voice, age/content handling, or release eligibility. Retired age metadata is not read.',
      'Game static coverage is reported separately and cannot satisfy the UI exact lookup gate. Cached dictionary lookup does not prove live loading, screen rendering, wrapping, or CDN publication.',
    ],
  }
}

function loadDictionary(file, layer, inputFindings) {
  if (!fs.existsSync(file)) {
    inputFindings.push({ scope: 'input', severity: 'diagnostic', code: 'missing-dictionary', layer, path: file })
    return { data: {}, sha256: null }
  }
  const bytes = fs.readFileSync(file)
  let value
  try { value = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')) }
  catch (error) { throw new Error(`Invalid JSON in ${file}: ${error.message}`) }
  if (!isObject(value)) throw new Error(`Dictionary must be a JSON object: ${file}`)
  if (!Object.keys(value).length) inputFindings.push({ scope: 'input', severity: 'diagnostic', code: 'empty-dictionary', layer, path: file })
  return { data: value, sha256: digest(bytes) }
}

export function runAudit(options) {
  const root = path.resolve(options.root ?? process.cwd())
  const snapshotFile = path.resolve(root, options.snapshot ?? 'snapshots/game-cache-ja_JP.json')
  if (!fs.existsSync(snapshotFile)) throw new Error(`Missing snapshot: ${snapshotFile}`)
  const snapshotBytes = fs.readFileSync(snapshotFile)
  const snapshot = JSON.parse(snapshotBytes.toString('utf8').replace(/^\uFEFF/, ''))
  // Reject bad/empty selections before loading dictionaries.
  selectProfileSources(snapshot, options)
  if (options.requireGame && !options.gameRoot) throw new Error('--require-game needs --game-root (the BepInEx directory)')
  const inputFindings = []
  const repo = {}
  const files = []
  for (const layer of ['another_name', 'descriptions', 'outgame', 'static']) {
    const file = path.join(root, 'translations', layer, 'ko_KR.json')
    const loaded = loadDictionary(file, `repo.${layer}`, inputFindings)
    repo[layer] = loaded.data
    files.push({ layer: `repo.${layer}`, path: file, sha256: loaded.sha256 })
  }
  let game = null
  let gameRoot = null
  if (options.gameRoot) {
    gameRoot = path.resolve(root, options.gameRoot)
    game = {}
    for (const layer of [...UI_LOOKUP_ORDER, 'static']) {
      const file = layer === 'local' ? path.join(gameRoot, 'config', 'AbyssMod', 'outgame-ko_KR.json') : path.join(gameRoot, 'plugins', 'AbyssMod', 'cache', 'ko_KR', `${layer}.json`)
      const loaded = loadDictionary(file, `game.${layer}`, inputFindings)
      game[layer] = loaded.data
      files.push({ layer: `game.${layer}`, path: file, sha256: loaded.sha256 })
    }
  }
  const report = auditProfileCoverage({ ...options, snapshot, repo, game })
  report.findings.unshift(...inputFindings)
  report.inputs = { root, snapshot: { path: snapshotFile, sha256: digest(snapshotBytes), generatedAt: snapshot.generatedAt ?? null, sourceCacheSha256: snapshot.cacheSha256 ?? null }, gameRoot, dictionaries: files }
  return report
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv)
    if (args.help) {
      console.log('Usage: node scripts/audit-character-profile-coverage.mjs (--profile-ids 300028,300036 | --all) [--snapshot path] [--root repo] [--game-root BepInEx] [--require-game] [--json-out path]')
      return 0
    }
    const report = runAudit(args)
    if (args.jsonOut) {
      const file = path.resolve(args.root, args.jsonOut)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', 'utf8')
    }
    console.log(`character-profile-coverage profiles=${report.selection.profileIds.length} locations=${report.counts.sourceLocations} uniqueSources=${report.counts.uniqueSourceStrings} repoCovered=${report.counts.repoCoveredLocations}/${report.counts.sourceLocations}`)
    if (report.inputs.gameRoot) console.log(`gameUiCovered=${report.counts.gameUiCoveredLocations}/${report.counts.sourceLocations} gameStaticCovered=${report.gameStatic.coveredLocations}/${report.counts.sourceLocations} requireGame=${report.requireGame}`)
    console.log(`findings=${report.findings.length} blocking=${report.findings.filter(finding => finding.severity === 'error').length} screenVerified=false`)
    return report.ok ? 0 : 1
  } catch (error) {
    console.error(`character-profile-coverage: ${error.message}`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main()
