import { sha } from './final-review-store.mjs'

// This resolves only external name lookups, never a dialogue or safety finding.
export function validateExternalNameResolution(finding, report, snapshot, names, proof) {
  if (finding.position !== undefined) return false
  let source = finding.source
  if (finding.type === 'external-name-missing') {
    // Preserve the older immutable finding shape without accepting ambiguous fields.
    if (finding.source !== undefined) return false
    source = finding.sourceName
  } else if (!['metadata-name-hold', 'external-name-metadata-hold'].includes(finding.type)) return false
  if (typeof source !== 'string' || !source.trim()) return false
  const matches = (report.resolvedExternalNames || []).filter(e => e.findingSha256 === sha(finding))
  if (matches.length !== 1) return false
  const entry = matches[0]
  if (entry.source !== source || typeof entry.value !== 'string' || !entry.value.trim() || names[entry.source] !== entry.value || entry.newSemanticCredit !== 0 || !entry.reason?.trim()) return false
  if (!proof || proof.passed !== true || proof.allNamesResolved !== true || !Array.isArray(proof.records)) return false
  return proof.records.some(r => r.id === snapshot.id && r.source === entry.source && r.translation === entry.value &&
    Number.isInteger(r.line) && r.line > 0 && Object.hasOwn(snapshot.caches, r.cacheFile) &&
    Array.isArray(r.fields) && r.fields.length === 4 && r.fields[0] === 'charaload' && r.fields.at(-1) === entry.source &&
    r.rawLine === r.fields.join(','))
}

