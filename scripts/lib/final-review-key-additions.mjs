import { sha } from './final-review-store.mjs'

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0

// Authorization is bound to the immutable pre-addition snapshot, never a new baseline.
export function validateKeyAdditions(snapshot, data, report = null) {
  const before = snapshot.originalTranslations
  const added = Object.keys(data).filter((key) => !Object.hasOwn(before, key))
  if (Object.keys(before).some((key) => !Object.hasOwn(data, key))) throw new Error('Translation keys changed: deletion or rename')
  if (report?.keyAdditions === undefined) {
    if (added.length) throw new Error('Translation keys changed: explicit keyAdditions required')
    return []
  }
  const entries = report.keyAdditions
  if (report.snapshot !== `${snapshot.id}-${sha(snapshot)}.json`) throw new Error('Key addition snapshot mismatch')
  if (!Array.isArray(entries) || !entries.length || entries.length !== added.length || !Array.isArray(report.decisions)) throw new Error('Key additions must exactly match actual additions')
  const seen = new Set()
  for (const entry of entries) {
    if (!entry || !added.includes(entry.source) || seen.has(entry.source)) throw new Error('Invalid or duplicate key addition')
    seen.add(entry.source)
    const positions = snapshot.rows.filter((row) => row.source === entry.source).map((row) => row.position)
    if (!positions.length || !Array.isArray(entry.positions) || entry.positions.length !== positions.length ||
        new Set(entry.positions).size !== positions.length || entry.positions.some((p) => !positions.includes(p))) throw new Error('Key addition must match every exact source-index occurrence')
    if (!nonempty(entry.evidence?.reference) || !nonempty(entry.evidence?.note)) throw new Error('Key addition evidence required')
    for (const position of positions) {
      const decisions = report.decisions.filter((d) => d?.position === position)
      if (decisions.length !== 1 || decisions[0].action !== 'add' || decisions[0].after !== data[entry.source] || !nonempty(decisions[0].reason)) throw new Error('Explicit add decision required for every occurrence')
    }
  }
  return added
}
