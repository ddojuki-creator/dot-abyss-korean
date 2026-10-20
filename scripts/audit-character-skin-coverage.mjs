#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {decodeMessagePack} from './lib/msgpack.mjs'
import {compareProtectedTokens} from './lib/ko-pipeline.mjs'
import {effectiveUiValue, translationState} from './audit-character-profile-coverage.mjs'

export const SKIN_FIELDS = Object.freeze({4: 'name', 5: 'description', 6: 'serif'})
const primaryLayers = {name: 'names', description: 'descriptions', serif: 'outgame'}
const ensure = (value, message) => { if (!value) throw Error(message) }
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const comparable = text => String(text).replace(/<\/?color(?:=[^>]*)?>/gi, '').replaceAll('\r\n', '\n').replace(/<br\s*\/?>/gi, '\n')

export function selectSkinRows(master, {skinIds = [], characterIds = [], all = false} = {}) {
  ensure([all, skinIds.length > 0, characterIds.length > 0].filter(Boolean).length === 1, 'Select exactly one skin, character or all scope')
  ensure([...skinIds, ...characterIds].every(id => Number.isInteger(id) && id > 0), 'Invalid IDs')
  ensure(Array.isArray(master.m_character_skins) && Array.isArray(master.m_characters), 'Missing skin/character MasterData')
  const characters = new Map(master.m_characters.map(row => [row[0], row[1]]))
  ensure(characterIds.every(id => characters.has(id)), 'Unknown selected character')
  const rows = master.m_character_skins.filter(row => all || skinIds.includes(row[0]) || characterIds.includes(row[1]))
  ensure(rows.length && skinIds.every(id => rows.some(row => row[0] === id)) && characterIds.every(id => rows.some(row => row[1] === id)), 'Selected skin/character has no matching skin')
  ensure(new Set(rows.map(row => row[0])).size === rows.length, 'Duplicate skin row ID')
  return rows.map(row => {
    ensure(characters.has(row[1]), 'Unknown skin owner')
    ensure(Object.keys(SKIN_FIELDS).every(slot => typeof row[slot] === 'string'), 'Skin field slots changed')
    return {skinId: row[0], characterId: row[1], characterName: characters.get(row[1]), skinType: row[2], asset: row[11], row}
  })
}

export function auditSkinCoverage({master, snapshot, skinIds = [], characterIds = [], all = false, repo = {}, game = null, collected = {}, requireGame = false}) {
  ensure(!requireGame || game, 'requireGame needs game dictionaries')
  const skins = selectSkinRows(master, {skinIds, characterIds, all}), records = [], blanks = [], findings = []
  const add = (scope, record, layer, code) => findings.push({scope, skinId: record.skinId, field: record.field, source: record.source, layer, code})
  for (const skin of skins) for (const [slot, field] of Object.entries(SKIN_FIELDS)) {
    const source = skin.row[slot], location = `m_character_skins/id:${skin.skinId}/${slot}`
    if (!source.trim()) { blanks.push({skinId: skin.skinId, field, location, source}); continue }
    ensure(snapshot.entries?.[location] === source, 'Snapshot differs from raw skin field: ' + location)
    const record = {skinId: skin.skinId, characterId: skin.characterId, characterName: skin.characterName, skinType: skin.skinType, asset: skin.asset, field, location, source, stored: {}}
    const primaryLayer = primaryLayers[field], reference = repo.outgame?.[source]
    // Raw skin fields are loaded from static and UI outgame. Name/description
    // registries are compatibility copies when present, not required legacy paths.
    const values = new Map([['outgame', reference], [`static.m_character_skins.${field}`, repo.static?.m_character_skins?.[field]?.[source]]])
    if (Object.hasOwn(repo[primaryLayer] || {}, source)) values.set(primaryLayer, repo[primaryLayer][source])
    for (const [layer, value] of values) {
      record.stored[layer] = value ?? null
      const state = translationState({[source]: value}, source)
      if (state.status !== 'translated') add('repo', record, layer, value === undefined ? 'missing' : state.status)
      else {
        if (compareProtectedTokens(source, value).length) add('repo', record, layer, 'protected-tokens')
        if (typeof reference === 'string' && comparable(value) !== comparable(reference)) add('repo', record, layer, 'value-mismatch')
      }
    }
    for (const [copyField, dictionary] of Object.entries(repo.static?.m_character_skins || {})) if (copyField !== field && Object.hasOwn(dictionary, source) && typeof reference === 'string' && comparable(dictionary[source]) !== comparable(reference)) add('repo', record, `static.m_character_skins.${copyField}`, 'compatibility-copy-mismatch')
    const cases = [{source, observed: Object.hasOwn(collected, source), kind: 'raw-field'}]
    for (const key of Object.keys(collected)) if (key !== source && comparable(key) === comparable(source)) cases.push({source: key, observed: true, kind: 'collected-linebreak-variant'})
    record.cases = cases.map(item => {
      const value = repo.outgame?.[item.source], state = translationState(repo.outgame, item.source)
      const variantRecord = {...record, source: item.source}
      if (item.kind !== 'raw-field') {
        if (state.status !== 'translated') add('repo', variantRecord, 'outgame', state.status)
        else {
          if (comparable(value) !== comparable(reference)) add('repo', variantRecord, 'outgame', 'variant-value-mismatch')
          if (compareProtectedTokens(item.source, value).length) add('repo', variantRecord, 'outgame', 'protected-tokens')
        }
      }
      const effective = game ? effectiveUiValue(game, item.source) : null
      if (game && (effective.status !== 'translated' || effective.value !== value)) add('game-ui', variantRecord, effective.layer, effective.status === 'translated' ? 'value-mismatch' : effective.status)
      return {...item, value: value ?? null, effective}
    })
    if (game) {
      record.gameStatic = translationState(game.static?.m_character_skins?.[field], source)
      if (record.gameStatic.status !== 'translated' || record.gameStatic.value !== repo.static?.m_character_skins?.[field]?.[source]) add('game-static', record, `static.m_character_skins.${field}`, record.gameStatic.status === 'translated' ? 'value-mismatch' : record.gameStatic.status)
    }
    records.push(record)
  }
  const count = scope => findings.filter(item => item.scope === scope).length
  return {
    kind: 'character-skin-source-and-installation-coverage',
    ok: count('repo') === 0 && (!requireGame || count('game-ui') + count('game-static') === 0),
    selection: {skinIds, characterIds, all},
    counts: {skins: skins.length, sourceLocations: records.length, uniqueSources: new Set(records.map(row => row.source)).size, acquisitionLocations: records.filter(row => row.field === 'serif').length, uniqueAcquisitionLines: new Set(records.filter(row => row.field === 'serif').map(row => row.source)).size, blankFields: blanks.length, repoIssues: count('repo'), gameUiIssues: game ? count('game-ui') : null, gameStaticIssues: game ? count('game-static') : null},
    blanks, records, findings, requireGame, gameChecked: Boolean(game), screenChecked: false, semanticReviewPerformed: false,
  }
}

export function runSkinAudit(args) {
  const root = path.resolve(args.root || process.cwd()), masterFile = path.resolve(root, args.masterCache), bytes = fs.readFileSync(masterFile)
  const snapshotFile = path.resolve(root, args.snapshot || 'snapshots/game-cache-ja_JP.json'), snapshot = read(snapshotFile)
  ensure(snapshot.cacheSha256 === hash(bytes), 'Snapshot cache hash differs from raw MasterData')
  const inputs = [], load = file => {
    if (!fs.existsSync(file)) { inputs.push({file, missing: true}); return {} }
    const bytes = fs.readFileSync(file); inputs.push({file, sha256: hash(bytes)}); return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  }
  const configFile = path.resolve(root, args.masterConfig || 'Config/master.json')
  ensure(fs.existsSync(configFile), 'Skin master config missing; use --master-config')
  const config = load(configFile)
  ensure(Object.values(SKIN_FIELDS).every(field => config.tables?.m_character_skins?.[field] === true), 'Skin static fields are disabled or unmapped')
  const repo = Object.fromEntries(['names', 'descriptions', 'outgame', 'static'].map(layer => [layer, load(path.join(root, 'translations', layer, 'ko_KR.json'))]))
  const gameRoot = args.gameRoot && path.resolve(args.gameRoot)
  let game = null
  if (gameRoot) {
    game = Object.fromEntries(['outgame', 'names', 'titles', 'descriptions', 'static'].map(layer => [layer, load(path.join(gameRoot, 'plugins/AbyssMod/cache/ko_KR', layer + '.json'))]))
    game.local = load(path.join(gameRoot, 'config/AbyssMod/outgame-ko_KR.json'))
  }
  const collectedFile = args.collected ? path.resolve(root, args.collected) : gameRoot ? path.join(gameRoot, 'config/AbyssMod/outgame-ja_JP.json') : null
  const collected = collectedFile ? load(collectedFile) : {}
  const report = auditSkinCoverage({...args, master: decodeMessagePack(bytes), snapshot, repo, game, collected})
  report.inputs = {masterFile, masterSha256: hash(bytes), snapshotFile, snapshotSha256: hash(fs.readFileSync(snapshotFile)), dictionaries: inputs}
  if (args.jsonOut) { const file = path.resolve(root, args.jsonOut); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n') }
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try {
  const args = {skinIds: [], characterIds: [], all: false, requireGame: false}
  const options = new Map([['--root', 'root'], ['--master-cache', 'masterCache'], ['--master-config', 'masterConfig'], ['--snapshot', 'snapshot'], ['--skin-ids', 'skinIds'], ['--character-ids', 'characterIds'], ['--game-root', 'gameRoot'], ['--collected', 'collected'], ['--json-out', 'jsonOut']])
  for (let index = 2; index < process.argv.length; index++) {
    const flag = process.argv[index]
    if (options.has(flag)) {
      const value = process.argv[++index]; ensure(value && !value.startsWith('--'), 'Missing option value')
      args[options.get(flag)] = ['--skin-ids', '--character-ids'].includes(flag) ? value.split(',').map(Number) : value
    } else if (flag === '--all') args.all = true
    else if (flag === '--require-game') args.requireGame = true
    else throw Error('Unknown option ' + flag)
  }
  ensure(args.masterCache, '--master-cache is required'); ensure(!args.requireGame || args.gameRoot, '--require-game needs --game-root')
  const report = runSkinAudit(args); console.log(JSON.stringify({ok: report.ok, ...report.counts, gameChecked: report.gameChecked, screenChecked: false})); if (!report.ok) process.exitCode = 1
} catch (error) { console.error(JSON.stringify({ok: false, error: error.message})); process.exitCode = 1 }
