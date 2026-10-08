#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {decodeMessagePack} from './lib/msgpack.mjs'
import {compareProtectedTokens} from './lib/ko-pipeline.mjs'
const options={}
for(let i=2;i<process.argv.length;i++){
 const flag=process.argv[i]
 if(flag==='--require-game')options.requireGame=true
 else if(['--master-cache','--snapshot','--game-root','--character-ids','--json-out'].includes(flag)){
  const value=process.argv[++i];if(!value||value.startsWith('--'))throw Error(`Missing ${flag}`)
  options[flag.slice(2)]=value
 }else throw Error(`Unknown option ${flag}`)
}
if(!options['master-cache'])throw Error('--master-cache is required')
if(options.requireGame&&!options['game-root'])throw Error('--require-game needs --game-root')
const digest=b=>crypto.createHash('sha256').update(b).digest('hex')
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''))
const bytes=fs.readFileSync(options['master-cache']),master=decodeMessagePack(bytes),snapshot=read(options.snapshot||'snapshots/game-cache-ja_JP.json')
const ids=options['character-ids']?.split(',').map(Number)
if(ids&&ids.some(n=>!Number.isInteger(n)||n<=0))throw Error('Invalid character IDs')
const rows=master.m_battle_result_reactions.filter(r=>!ids||ids.includes(r[1]))
if(!rows.length)throw Error('No matching reaction rows')
if(ids?.some(id=>!rows.some(r=>r[1]===id)))throw Error('Selected character has no reaction rows')
const layers=['outgame','names','titles','descriptions'],inputs=[],load=f=>{
 if(!fs.existsSync(f)){inputs.push({file:f,missing:true});return {}}
 const b=fs.readFileSync(f);inputs.push({file:f,sha256:digest(b)});return JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''))
}
const repo=layers.map(l=>[l,load(`translations/${l}/ko_KR.json`)])
const game=options['game-root']?[...layers.map(l=>[l,load(path.join(options['game-root'],'plugins/AbyssMod/cache/ko_KR',`${l}.json`))]),['local',load(path.join(options['game-root'],'config/AbyssMod/outgame-ko_KR.json'))]]:[]
const lookup=(dicts,key)=>{const row=dicts.find(([,d])=>Object.hasOwn(d,key));return row?{layer:row[0],value:row[1][key]}:null}
const issues=[],records=[]
for(const r of rows){
 const [id,characterId,resultType,source]=r,location=`m_battle_result_reactions/id:${id}/3`
 if(typeof source!=='string')throw Error('Reaction text slot changed')
 const character=master.m_characters.find(c=>c[0]===characterId)
 if(!character)issues.push({id,code:'unknown_character'})
 if(snapshot.entries[location]!==source)issues.push({id,code:'snapshot_source_mismatch'})
 const expected=lookup(repo,source),actual=lookup(game,source)
 if(!expected||!expected.value?.trim()||expected.value===source||/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(expected.value))issues.push({id,code:'repository_translation_missing_or_untranslated'})
 else if(compareProtectedTokens(source,expected.value).length)issues.push({id,code:'protected_tokens'})
 if(game.length&&(!actual||actual.value!==expected?.value))issues.push({id,code:!actual?'game_missing':'game_value_mismatch'})
 records.push({id,characterId,characterName:character?.[1],resultType,location,source,repository:expected,game:actual})
}
const gameIssues=issues.filter(i=>i.code.startsWith('game_')).length
const report={sourceCache:options['master-cache'],sourceCacheSha256:digest(bytes),snapshotSourceHashMatched:snapshot.cacheSha256===digest(bytes),inputs,records,issues,summary:{rows:rows.length,characters:new Set(rows.map(r=>r[1])).size,uniqueTexts:new Set(rows.map(r=>r[3])).size,repositoryIssues:issues.length-gameIssues,gameIssues},screenVerified:false}
if(options['json-out']){fs.mkdirSync(path.dirname(options['json-out']),{recursive:true});fs.writeFileSync(options['json-out'],JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report.summary))
if(report.summary.repositoryIssues||(options.requireGame&&gameIssues))process.exitCode=1
