import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const ensure=(ok,code)=>{if(!ok)throw Error(code)}
export const cdnByteHash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')
// Match scripts/update-manifest.mjs objectHash: sorted paths and NUL fields.
// The manifest hashes parsed dictionaries, whereas CDN proof hashes bytes.
export function cdnManifestHash(bytes) {
  const object=JSON.parse(Buffer.from(bytes).toString('utf8')),md5=crypto.createHash('md5')
  const traverse=(value,prefix='')=>{
    for(const key of Object.keys(value).sort()){
      const item=value[key],field=prefix?prefix+'\x01'+key:key
      if(item&&typeof item==='object'&&!Array.isArray(item))traverse(item,field)
      else{md5.update(field,'utf8');md5.update('\0','utf8');md5.update(String(item),'utf8');md5.update('\0','utf8')}
    }
  }
  traverse(object);return md5.digest('hex')
}
export function verifyCdnBytes({status,bytes,expectedHash}) {
  return status===200&&cdnByteHash(bytes)===expectedHash
}
export function flattenStaticDictionary(dictionary) {
  const values=Object.create(null)
  for(const [table,fields] of Object.entries(dictionary))for(const [field,entries] of Object.entries(fields))
    for(const [source,value] of Object.entries(entries))values[`${table}\x01${field}\x01${source}`]=value
  return values
}
export function isSupportingCdnFile(file) {
  return typeof file==='string'&&!file.includes('..')&&(
    /^(?:docs|scripts)\/[\w./-]+\.(?:md|mjs)$/.test(file)||file==='translations/ability_descriptions/ko_KR.json')
}
export function verifySourceCoverage({id,keys,dictionary,manifest,expectedFileHash,kind='novel'}) {
  ensure(Array.isArray(keys)&&new Set(keys).size===keys.length&&keys.every(key=>typeof key==='string'),'cdn_source_keys_invalid')
  ensure(dictionary&&typeof dictionary==='object'&&!Array.isArray(dictionary),'cdn_dictionary_invalid')
  const values=kind==='dictionary'&&id==='static'?flattenStaticDictionary(dictionary):dictionary
  ensure(keys.every(key=>typeof values[key]==='string'&&values[key].trim()),'cdn_source_value_missing')
  ensure((kind==='dictionary'?manifest?.[id]:manifest?.novels?.[id])===expectedFileHash,'cdn_manifest_file_hash_mismatch')
  return {id,sourceKeys:keys.length,repositoryKeys:Object.keys(values).length,sourceMissing:0,compatibilityKeys:Object.keys(values).filter(key=>!keys.includes(key)).length,manifestMatched:true}
}
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))
const hashFile=file=>cdnByteHash(fs.readFileSync(file))
const relative=file=>path.relative(ROOT,file).replaceAll('\\','/')
const inside=(root,file)=>file===root||file.startsWith(root+path.sep)
const rootPath=file=>{
  const full=path.resolve(ROOT,file),rel=relative(full).toLowerCase()
  ensure(inside(ROOT,full)&&!rel.startsWith('legacy/')&&!rel.includes('age-review')&&!rel.includes('character-age-status'),'cdn_input_path_invalid')
  return full
}
const save=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')
const git=(checkout,args,raw=false)=>{
  const result=spawnSync('git',args,{cwd:checkout,encoding:raw?undefined:'utf8',maxBuffer:32*1024*1024})
  ensure(result.status===0,'cdn_git_failed');return raw?result.stdout:result.stdout.trim()
}

async function main() {
  const args=process.argv.slice(2),option=name=>{const n=args.indexOf(name);ensure(n>=0&&args[n+1]&&!args[n+1].startsWith('--'),'cdn_required_option_missing');return args[n+1]}
  const receiptFile=rootPath(option('--publication-receipt')),planFile=rootPath(option('--source-plan')),out=rootPath(option('--run-dir')),commit=option('--commit')
  ensure(/^[a-f0-9]{40}$/.test(commit)&&inside(path.join(ROOT,'work'),out)&&!fs.existsSync(path.join(out,'cdn-verification.json')),'cdn_output_or_commit_invalid')
  const publication=read(receiptFile),plan=read(planFile),checkout=path.resolve(publication.checkout)
  ensure(fs.statSync(checkout).isDirectory(),'cdn_checkout_invalid')
  ensure(publication.prepared===true&&publication.published===true&&publication.commitHash===commit&&publication.remoteHeadAfterPush===commit,'cdn_publication_unverified')
  ensure(plan.status==='current_review_inputs_prepared'&&Array.isArray(plan.files)&&plan.files.length>0,'cdn_source_plan_invalid')
  const inputHashes={[relative(receiptFile)]:hashFile(receiptFile),[relative(planFile)]:hashFile(planFile)}
  const checkInputs=()=>{for(const [file,digest] of Object.entries(inputHashes))ensure(hashFile(rootPath(file))===digest,'cdn_input_changed')}
  const remoteHead=()=>git(checkout,['ls-remote','origin','refs/heads/main']).split(/\s+/)[0]
  ensure(remoteHead()===commit&&git(checkout,['rev-parse','HEAD'])===commit&&git(checkout,['status','--porcelain','--untracked-files=all'])==='','cdn_checkout_or_remote_changed')
  const remote=git(checkout,['remote','get-url','origin']),repo=remote.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1]
  ensure(repo&&/^[\w.-]+\/[\w.-]+$/.test(repo),'cdn_github_remote_invalid')
  const paths=new Set(['translations/manifest/ko_KR.json']),sourceRows=[]
  for(const row of plan.files){
    const common=row.kind==='dictionary'
    ensure(/^[A-Za-z0-9_-]+$/.test(row.id)&&(common?
      ['names','titles','descriptions','another_name','outgame','static'].includes(row.id)&&row.logicalFile===`translations/${row.id}/ko_KR.json`:
      row.logicalFile===`translations/novels/${row.id}/ko_KR.json`),'cdn_source_id_invalid')
    const file=rootPath(row.sourceKeys);ensure(hashFile(file)===row.sourceKeysHash,'cdn_source_keys_changed');inputHashes[relative(file)]=row.sourceKeysHash
    const keys=read(file);sourceRows.push({id:row.id,file:row.logicalFile,keys,kind:common?'dictionary':'novel'});paths.add(row.logicalFile)
  }
  const supporting=new Set(plan.supportingFiles??[])
  ensure([...supporting].every(isSupportingCdnFile),'cdn_supporting_file_invalid')
  ensure(publication.changedFiles.every(file=>paths.has(file)||supporting.has(file)),'cdn_changed_file_outside_source_plan')
  for(const file of supporting)paths.add(file)
  ensure(JSON.stringify(git(checkout,['diff','--name-only',publication.base,commit]).split(/\r?\n/).filter(Boolean).sort())===JSON.stringify([...publication.changedFiles].sort()),'cdn_publication_file_list_mismatch')
  const expected=new Map([...paths].map(file=>[file,git(checkout,['show',commit+':'+file],true)])),manifest=JSON.parse(expected.get('translations/manifest/ko_KR.json'))
  const sourceCoverage=sourceRows.map(row=>verifySourceCoverage({id:row.id,kind:row.kind,keys:row.keys,dictionary:JSON.parse(expected.get(row.file)),manifest,expectedFileHash:cdnManifestHash(expected.get(row.file))}))
  fs.mkdirSync(path.join(out,'responses'),{recursive:true})
  const publicationSnapshot=path.join(out,'publication-input.json')
  fs.copyFileSync(receiptFile,publicationSnapshot,fs.constants.COPYFILE_EXCL)
  ensure(hashFile(publicationSnapshot)===inputHashes[relative(receiptFile)],'cdn_publication_snapshot_changed')
  const proof={schemaVersion:1,status:'cdn_verification_running',created:new Date().toISOString(),commit,remoteHeadBefore:commit,repository:repo,inputHashes,publicationInput:{originalFile:relative(receiptFile),snapshotFile:relative(publicationSnapshot),sha256:hashFile(publicationSnapshot)},requests:[],sourceCoverage,gameCacheChecked:false,gameScreenChecked:false,bodyInterpreted:false,publicationPerformed:false}
  const targets=[...paths].flatMap(file=>[{file,kind:'branch',ref:'refs/heads/main'},{file,kind:'fixed',ref:commit}]),matched=new Set()
  for(let attempt=1;attempt<=4&&matched.size<targets.length;attempt++){
    const pending=targets.filter(target=>!matched.has(target.kind+':'+target.file))
    const results=await Promise.allSettled(pending.map(async target=>{
      const url=`https://raw.githubusercontent.com/${repo}/${target.ref}/${target.file}`,expectedHash=cdnByteHash(expected.get(target.file))
      try{
        const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)}),bytes=Buffer.from(await response.arrayBuffer())
        const ok=verifyCdnBytes({status:response.status,bytes,expectedHash}),item={...target,url,attempt,checkedAt:new Date().toISOString(),status:response.status,expectedHash,sha256:cdnByteHash(bytes),bytes:bytes.length,matched:ok}
        if(ok){const file=path.join(out,'responses',target.kind+'-'+target.file.replaceAll('/','_'));fs.writeFileSync(file,bytes);item.responseFile=relative(file)}return item
      }catch(error){return {...target,url,attempt,checkedAt:new Date().toISOString(),expectedHash,matched:false,error:error.name}}
    }))
    for(let n=0;n<results.length;n++){const result=results[n],item=result.status==='fulfilled'?result.value:{...pending[n],attempt,matched:false,error:'fetch_failed'};proof.requests.push(item);if(item.matched)matched.add(item.kind+':'+item.file)}
    save(path.join(out,'cdn-verification.json'),proof);console.log(JSON.stringify({attempt,matched:matched.size,total:targets.length}))
    if(matched.size<targets.length&&attempt<4)await new Promise(resolve=>setTimeout(resolve,15000))
  }
  ensure(matched.size===targets.length,'cdn_bytes_not_matched');checkInputs();ensure(remoteHead()===commit,'cdn_remote_changed_after_verification')
  proof.status='selected_cdn_verified';proof.finished=new Date().toISOString();proof.remoteHeadAfter=commit;proof.passed=true;proof.summary={files:paths.size,requests:targets.length,matched:matched.size,sourceFiles:sourceRows.length,sourceKeys:sourceCoverage.reduce((sum,row)=>sum+row.sourceKeys,0),sourceMissing:0,gameScreenChecked:false}
  save(path.join(out,'cdn-verification.json'),proof);console.log(JSON.stringify({status:proof.status,receipt:relative(path.join(out,'cdn-verification.json')),sha256:hashFile(path.join(out,'cdn-verification.json')),...proof.summary}))
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({status:'cdn_verification_failed',error:/^[a-z0-9_]+$/.test(error.message)?error.message:'cdn_io_failed'}));process.exitCode=1})
