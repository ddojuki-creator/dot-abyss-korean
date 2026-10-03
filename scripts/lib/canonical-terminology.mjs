import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {extractProtectedTokens} from './ko-pipeline.mjs'

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const hash=text=>crypto.createHash('sha256').update(text).digest('hex')
// A diagnostic for explicit fixed mappings. Contextual suggestions are never global rules.
export function compileCanonicalTerminology(text) {
  const rules=[]
  for(const [index,line]of text.split(/\r?\n/).entries()){
    if(!line.startsWith('|'))continue
    const cells=line.split('|').slice(1,-1).map(c=>c.trim())
    if(cells.length<3||!/(?:always\s+(?:use|preserve)\b|반드시.{0,40}(?:번역|사용))/i.test(cells[2]))continue
    if(/(?:고정.{0,30}아니|not (?:a |an )?(?:fixed|global)|unless|문맥에 따라)/i.test(cells[2]))continue
    const [scope,terms]=cells[0].includes('의 ')?cells[0].split(/의 (.*)/s):['',cells[0]]
    const sourceTerms=terms.split(' / ').map(s=>s.replaceAll('`','').trim()).filter(s=>s&&!/[<>\[\]{}]/.test(s)&&/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z]/u.test(s))
    const approved=cells[1].split(' / ').map(s=>s.replaceAll('`','').trim()).filter(s=>s&&!/[<>\[\]{}]/.test(s))
    if(sourceTerms.length&&approved.length)rules.push({sourceTerms,approved,scope,line:index+1,note:cells[2]})
  }
  return {rules,glossaryHash:hash(text)}
}

function prose(value){
  if(typeof value!=='string')return ''
  let text=value
  for(const token of [...new Set(extractProtectedTokens(value))].sort((a,b)=>b.length-a.length))text=text.replaceAll(token,'')
  return text
}
function contains(text,term){
  if(/^[A-Za-z][A-Za-z0-9_. -]*$/.test(term))return new RegExp('(?<![A-Za-z_])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z_])','u').test(text)
  return text.includes(term)
}
const forbiddenNames=[
  ['パウリーナ',['파우리나']],['ヒマリ',['히말리']],
  ['クルル',['크루루','크룰루','쿠룰루']],['ミルティーユ',['밀피유','미르티유']],
  ['ルクスノヴァ',['루크스노바','럭스노바','루크스 노바','럭스 노바']],
]
let cached=null
function currentRules(){const text=fs.readFileSync(path.join(ROOT,'docs/translation/glossary.md'),'utf8').replace(/^\uFEFF/,'');const digest=hash(text);if(cached?.glossaryHash!==digest)cached=compileCanonicalTerminology(text);return cached}

export function canonicalTerminologyProblems(source,value,{speakerAliases=[],compiled=currentRules()}={}){
  const sourceProse=prose(source),targetProse=prose(value),problems=[]
  for(const rule of compiled.rules){
    if(rule.scope&&!speakerAliases.includes(rule.scope))continue
    const matchedSourceTerms=rule.sourceTerms.filter(t=>contains(sourceProse,t))
    if(!matchedSourceTerms.length||rule.approved.some(t=>contains(targetProse,t)))continue
    problems.push({code:'missing_approved_fixed_term',sourceTerms:matchedSourceTerms,approved:rule.approved,glossaryLine:rule.line,glossaryHash:compiled.glossaryHash,scope:rule.scope||null,interpretation:'Fixed source mapping not present; requires source/context correction or a documented contextual decision. This is not full semantic review.'})
  }
  for(const [sourceName,variants]of forbiddenNames){
    if(!sourceProse.includes(sourceName))continue
    const rule=compiled.rules.find(r=>!r.scope&&r.sourceTerms.includes(sourceName))
    if(!rule)continue
    for(const variant of variants){if(rule.approved.includes(variant))continue;const occurrences=targetProse.split(variant).length-1;if(occurrences)problems.push({code:'forbidden_name_variant',sourceTerms:[sourceName],approved:rule.approved,variant,occurrences,glossaryHash:compiled.glossaryHash})}
  }
  return problems
}
