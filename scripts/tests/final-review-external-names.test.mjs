import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {sha} from '../lib/final-review-store.mjs'
import {validateExternalNameResolution as validate} from '../lib/final-review-external-names.mjs'
const fixture=()=>{
 const finding={type:'metadata-name-hold',source:'Alias',reason:'Absent exact load name'}
 const snapshot={id:'mas_1001020402',caches:{cache:'hash'}}
 const names={Alias:'Name'}
 const report={resolvedExternalNames:[{findingSha256:sha(finding),source:'Alias',value:'Name',newSemanticCredit:0,reason:'Exact source-backed alias added'}]}
 const proof={passed:true,allNamesResolved:true,records:[{id:snapshot.id,source:'Alias',translation:'Name',cacheFile:'cache',line:9,fields:['charaload','chara_1','123','Alias'],rawLine:'charaload,chara_1,123,Alias'}]}
 return {finding,snapshot,names,report,proof}
}
const run=f=>validate(f.finding,f.report,f.snapshot,f.names,f.proof)
test('external name resolution binds exact prior finding and current alias',()=>assert.equal(run(fixture()),true))
for (const [type,field] of [['metadata-name-hold','source'],['external-name-missing','sourceName']])
test(`CLI rejects unbound evidence and preserves the original ${type} receipt`, (t) => {
  const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'abyss-name-resolution-test-'))
  t.after(()=>{const rel=path.relative(path.resolve(os.tmpdir()),path.resolve(root));assert.ok(rel.startsWith('abyss-name-resolution-test-')&&!rel.includes(path.sep));fs.rmSync(root,{recursive:true,force:true})})
  const put=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(v))}
  fs.cpSync(path.join(repo,'docs/translation'),path.join(root,'docs/translation'),{recursive:true})
  const id='mas_9999999999',cache=path.join(root,'.cache/source.txt')
  put('.cache/source.txt','fixture only')
  put('.cache/novel-message-index.json',[{novelId:id,cacheFile:cache,line:2,command:'message',speaker:'test',source:'hello'}])
  put('translations/novels/'+id+'/ko_KR.json',{hello:'hello'})
  put('translations/names/ko_KR.json',{Alias:'Name'})
  const run=(...args)=>spawnSync(process.execPath,[path.join(repo,'scripts/final-review-progress.mjs'),...args],{cwd:root,encoding:'utf8'})
  const ok=(...args)=>{const r=run(...args);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)}
  ok('init');const {snapshot}=ok('prepare',id)
  const finding={type,[field]:'Alias',reason:'Missing load alias'}
  const report={id,snapshot,reviewer:'test',semanticReview:true,ranges:[{from:1,to:1,note:'Fixture context'}],decisions:[],unresolvedBlocking:[finding],complete:false}
  put('report.json',report);const held=ok('record','report.json')
  const holdBytes=fs.readFileSync(path.join(root,held.checkpoint))
  report.complete=true;report.unresolvedBlocking=[]
  put('report.json',report);assert.notEqual(run('record','report.json').status,0)
  const proof={passed:true,allNamesResolved:true,records:[{id,cacheFile:cache,line:1,source:'Alias',translation:'Name',fields:['charaload','chara_1','123','Alias'],rawLine:'charaload,chara_1,123,Alias'}]}
  const proofPath='docs/reviews/final-review/name-proof.json';put(proofPath,proof)
  report.resolvedExternalNames=[{findingSha256:sha(finding),source:'Alias',value:'Name',newSemanticCredit:0,reason:'Bound alias',proof:{path:proofPath,sha256:'0'.repeat(64)}}]
  put('report.json',report);assert.notEqual(run('record','report.json').status,0)
  report.resolvedExternalNames[0].proof.sha256=sha(fs.readFileSync(path.join(root,proofPath)))
  put('outside.json',proof);report.resolvedExternalNames[0].proof.path='outside.json'
  put('report.json',report);assert.notEqual(run('record','report.json').status,0)
  report.resolvedExternalNames[0].proof.path=proofPath;put('report.json',report)
  assert.equal(ok('record','report.json').complete,true)
  assert.deepEqual(fs.readFileSync(path.join(root,held.checkpoint)),holdBytes)
})
test('does not discharge position-bearing, safety or parser findings',()=>{
 for(const change of [{position:1},{type:'safety-hold'},{type:'source-parser-payload-boundary'}]){const f=fixture();Object.assign(f.finding,change);f.report.resolvedExternalNames[0].findingSha256=sha(f.finding);assert.equal(run(f),false)}
})
test('requires exact current value, zero semantic credit and unique finding evidence',()=>{
 for(const mutate of [f=>f.names.Alias='Other',f=>f.report.resolvedExternalNames[0].newSemanticCredit=1,f=>f.report.resolvedExternalNames.push(f.report.resolvedExternalNames[0]),f=>f.report.resolvedExternalNames[0].findingSha256='wrong']){const f=fixture();mutate(f);assert.equal(run(f),false)}
})
test('rejects missing, unrelated, unresolved or malformed raw load proof',()=>{
 for(const mutate of [f=>f.proof=null,f=>f.proof.passed=false,f=>f.proof.allNamesResolved=false,f=>f.proof.records[0].id='other',f=>f.proof.records[0].cacheFile='other',f=>f.proof.records[0].fields[0]='objectload',f=>f.proof.records[0].rawLine='other',f=>f.proof.records[0].translation='Other']){const f=fixture();mutate(f);assert.equal(run(f),false)}
})

const legacyFixture=()=>{const f=fixture();f.finding={type:'external-name-missing',sourceName:'Alias',reason:'Missing load alias'};f.report.resolvedExternalNames[0].findingSha256=sha(f.finding);return f}
test('supports the exact external-name-missing sourceName finding shape',()=>assert.equal(run(legacyFixture()),true))
test('rejects absent, ambiguous or mismatched legacy source names',()=>{
 for(const mutate of [f=>delete f.finding.sourceName,f=>f.finding.sourceName='',f=>f.finding.source='Alias',f=>f.finding.source='Other',f=>f.finding.sourceName='Other',f=>f.finding.sourceName=12]){const f=legacyFixture();mutate(f);f.report.resolvedExternalNames[0].findingSha256=sha(f.finding);assert.equal(run(f),false)}
})
test('legacy metadata compatibility cannot clear dialogue or bypass bound proof requirements',()=>{
 for(const mutate of [f=>f.finding.position=1,f=>f.finding.type='safety-hold',f=>f.finding.type='source-parser-payload-boundary',f=>f.proof.records[0].fields[0]='objectload',f=>f.report.resolvedExternalNames[0].newSemanticCredit=1,f=>f.proof=null,f=>f.names.Alias='Other',f=>f.report.resolvedExternalNames.push(f.report.resolvedExternalNames[0])]){const f=legacyFixture();mutate(f);f.report.resolvedExternalNames[0].findingSha256=sha(f.finding);assert.equal(run(f),false)}
})
