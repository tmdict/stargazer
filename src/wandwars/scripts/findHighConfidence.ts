/**
 * One-off diagnostic: find historical matchups that trigger HIGH confidence
 * for Composite and Bradley-Terry. Helps verify the confidence thresholds
 * are identifying real matchups, not theoretical edge cases.
 *
 * Run: npx tsx src/wandwars/scripts/findHighConfidence.ts
 */

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { analyzeMatches } from '../prediction/analysis'
import { fitBradleyTerry } from '../prediction/bradleyTerry'
import { CONFIDENCE_THRESHOLDS } from '../prediction/calibrationData'
import { computeAllSelfConfidences } from '../prediction/modelConfidence'
import { getUniqueHeroes, parseMatchData } from '../records/parser'

const rawDir = join(import.meta.dirname!, '..', 'data', 'raw')
const dataFiles = readdirSync(rawDir).filter((f) => f.endsWith('.data'))
let allRaw = ''
for (const f of dataFiles) allRaw += readFileSync(join(rawDir, f), 'utf-8') + '\n'

const matches = parseMatchData(allRaw)
const heroes = getUniqueHeroes(matches)
const analysis = analyzeMatches(matches, heroes)
const btFit = fitBradleyTerry(matches, analysis)

const tCompositeHigh = CONFIDENCE_THRESHOLDS.perModel.composite?.high ?? 1.01
const tBTHigh = CONFIDENCE_THRESHOLDS.perModel['bradley-terry']?.high ?? 1.01

console.log(`Thresholds: Composite HIGH ≥ ${tCompositeHigh}, B-T HIGH ≥ ${tBTHigh}`)
console.log(`Total matches: ${matches.length}\n`)

interface MatchScore {
  left: string[]
  right: string[]
  composite: number
  bt: number
  pp: number
  nn: number
  minHigh: number
  bothHigh: boolean
}

const scored: MatchScore[] = []
for (const m of matches) {
  const sc = computeAllSelfConfidences(m.left, m.right, analysis, matches, btFit)
  const composite = sc.composite ?? 0
  const bt = sc['bradley-terry'] ?? 0
  const pp = sc['popular-pick'] ?? 0
  const nn = sc['adaptive-ml'] ?? 0
  const compositeHigh = composite >= tCompositeHigh
  const btHigh = bt >= tBTHigh
  if (compositeHigh || btHigh) {
    scored.push({
      left: m.left,
      right: m.right,
      composite,
      bt,
      pp,
      nn,
      minHigh: Math.min(compositeHigh ? composite : 1, btHigh ? bt : 1),
      bothHigh: compositeHigh && btHigh,
    })
  }
}

// De-duplicate on sorted team-pair key
const seen = new Set<string>()
const unique: MatchScore[] = []
for (const s of scored) {
  const key = [s.left.slice().sort().join(','), s.right.slice().sort().join(',')].sort().join('|')
  if (seen.has(key)) continue
  seen.add(key)
  unique.push(s)
}

console.log(`Unique matchups triggering HIGH on Composite or B-T: ${unique.length}\n`)

const bothHigh = unique.filter((s) => s.bothHigh)
console.log(`--- BOTH Composite + B-T HIGH (${bothHigh.length}) ---`)
bothHigh
  .sort((a, b) => b.composite + b.bt - (a.composite + a.bt))
  .slice(0, 10)
  .forEach((s) => {
    console.log(`  ${s.left.join(', ')}  vs  ${s.right.join(', ')}`)
    console.log(
      `     composite=${s.composite.toFixed(2)}  bt=${s.bt.toFixed(2)}  pp=${s.pp.toFixed(2)}  nn=${s.nn.toFixed(2)}`,
    )
  })

const compositeOnly = unique.filter((s) => s.composite >= tCompositeHigh && s.bt < tBTHigh)
console.log(`\n--- Composite HIGH only (${compositeOnly.length}) ---`)
compositeOnly
  .sort((a, b) => b.composite - a.composite)
  .slice(0, 5)
  .forEach((s) => {
    console.log(`  ${s.left.join(', ')}  vs  ${s.right.join(', ')}`)
    console.log(`     composite=${s.composite.toFixed(2)}  bt=${s.bt.toFixed(2)}`)
  })

const btOnly = unique.filter((s) => s.bt >= tBTHigh && s.composite < tCompositeHigh)
console.log(`\n--- B-T HIGH only (${btOnly.length}) ---`)
btOnly
  .sort((a, b) => b.bt - a.bt)
  .slice(0, 5)
  .forEach((s) => {
    console.log(`  ${s.left.join(', ')}  vs  ${s.right.join(', ')}`)
    console.log(`     composite=${s.composite.toFixed(2)}  bt=${s.bt.toFixed(2)}`)
  })
