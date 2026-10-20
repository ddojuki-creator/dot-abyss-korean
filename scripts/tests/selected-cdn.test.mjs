import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {cdnByteHash,cdnManifestHash,verifyCdnBytes,verifySourceCoverage,isSupportingCdnFile,readGitBytes} from '../verify-selected-cdn.mjs'

test('Git blob verification preserves files larger than the former 32 MiB output limit',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'abyssmod-cdn-large-test-'))
  try {
    execFileSync('git',['init','--bare',directory],{stdio:'ignore'})
    const bytes=Buffer.alloc(33*1024*1024+7,0x61),file=path.join(directory,'input.bin')
    bytes.write('\n한국어\n',bytes.length-16)
    fs.writeFileSync(file,bytes)
    const oid=execFileSync('git',['-c','core.autocrlf=false','-C',directory,'hash-object','-w',file],{encoding:'utf8'}).trim()
    const actual=readGitBytes(directory,['cat-file','blob',oid])
    assert.equal(actual.length,bytes.length)
    assert.equal(cdnByteHash(actual),cdnByteHash(bytes))
    assert.throws(()=>readGitBytes(directory,['cat-file','blob','missing-object']),/cdn_git_failed/)
  } finally {
    const resolved=path.resolve(directory),parent=path.resolve(os.tmpdir())
    assert.ok(resolved.startsWith(parent+path.sep)&&path.basename(resolved).startsWith('abyssmod-cdn-large-test-'))
    fs.rmSync(resolved,{recursive:true,force:true})
  }
})
test('CDN requires successful status and exact bytes, including newlines',()=>{
  const bytes=Buffer.from('saved\n'),expectedHash=cdnByteHash(bytes)
  assert.equal(verifyCdnBytes({status:200,bytes,expectedHash}),true)
  assert.equal(verifyCdnBytes({status:404,bytes,expectedHash}),false)
  assert.equal(verifyCdnBytes({status:200,bytes:Buffer.from('saved'),expectedHash}),false)
})
test('manifest object MD5 and CDN byte SHA256 retain their separate contracts',()=>{
  assert.equal(cdnManifestHash(Buffer.from('{"source":"한국어"}')),'90e4af33551e6afd8d53519f7ba63de6')
  assert.equal(cdnByteHash(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const one=Buffer.from('{"z":"last","a":{"b":"nested"}}'),two=Buffer.from('{ "a": {"b":"nested"}, "z":"last" }')
  assert.equal(cdnManifestHash(one),cdnManifestHash(two))
  assert.notEqual(cdnByteHash(one),cdnByteHash(two))
  assert.notEqual(cdnManifestHash(one),cdnManifestHash(Buffer.from('{"z":"last","a":{"b":"changed"}}')))
})
test('source coverage preserves compatibility keys without accepting absent or blank translations',()=>{
  const input={id:'id',keys:['source'],dictionary:{source:'한국어',compatibility:'이전'},manifest:{novels:{id:'digest'}},expectedFileHash:'digest'}
  assert.equal(verifySourceCoverage(input).compatibilityKeys,1)
  assert.throws(()=>verifySourceCoverage({...input,dictionary:{}}),/cdn_source_value_missing/)
  assert.throws(()=>verifySourceCoverage({...input,dictionary:{source:' '}}),/cdn_source_value_missing/)
  assert.throws(()=>verifySourceCoverage({...input,manifest:{novels:{id:'different'}}}),/cdn_manifest_file_hash_mismatch/)
})
test('common dictionary checks its own manifest field rather than a novel entry',()=>{
  const input={id:'outgame',kind:'dictionary',keys:['source'],dictionary:{source:'한국어'},manifest:{outgame:'digest',novels:{outgame:'wrong'}},expectedFileHash:'digest'}
  assert.equal(verifySourceCoverage(input).manifestMatched,true)
  assert.throws(()=>verifySourceCoverage({...input,manifest:{novels:{outgame:'digest'}}}),/cdn_manifest_file_hash_mismatch/)
})
test('static coverage identifies the table and field without conflating reused source strings',()=>{
  const key='source/with\n<color=#fff>tags</color>',dictionary={table:{name:{[key]:'이름'},description:{[key]:'설명'}}}
  const input={id:'static',kind:'dictionary',keys:['table\x01description\x01'+key],dictionary,manifest:{static:'digest'},expectedFileHash:'digest'}
  assert.equal(verifySourceCoverage(input).repositoryKeys,2)
  assert.equal(verifySourceCoverage(input).compatibilityKeys,1)
  assert.throws(()=>verifySourceCoverage({...input,keys:['table\x01missing\x01'+key]}),/cdn_source_value_missing/)
  assert.throws(()=>verifySourceCoverage({...input,dictionary:{table:{description:{[key]:''}}}}),/cdn_source_value_missing/)
})
test('supporting CDN files permit reviewed source assets without permitting unrelated translation paths',()=>{
  for(const file of ['docs/translation/character-cards.md','scripts/verify-selected-cdn.mjs','translations/ability_descriptions/ko_KR.json'])assert.equal(isSupportingCdnFile(file),true)
  for(const file of ['../docs/guide.md','docs/../legacy/age-review.md','translations/names/ko_KR.json','translations/ability_descriptions/ja_JP.json','legacy/character-age-status.yaml'])assert.equal(isSupportingCdnFile(file),false)
})
