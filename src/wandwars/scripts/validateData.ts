/**
 * Sanity-check a new raw .data file against the existing baseline before
 * merging it into the training set.
 *
 * Output is structured as:
 *   1. VERDICT — single PASS/WARN/FAIL line based on held-out prediction
 *      accuracy (the strongest signal that new data behaves like baseline).
 *   2. Parse + coverage checks.
 *   3. Distribution summary (left-win rate, draws, sweep rate) with drift notes.
 *   4. Held-out prediction table (models trained on baseline only).
 *   5. Per-hero shifts — only heroes whose candidate win rate falls outside
 *      the baseline's 95% Wilson interval. Small-sample noise filtered out.
 *
 * Usage: npm run ww:validate <filename>.data
 */

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import { analyzeMatches } from '../prediction/analysis'
import { bradleyTerryModel } from '../prediction/bradleyTerry'
import { compositeModel } from '../prediction/composite'
import { popularPickModel } from '../prediction/popularPick'
import { getUniqueHeroes, parseMatchData } from '../records/parser'
import type { MatchResult } from '../types'

const candidateArg = process.argv[2]
if (!candidateArg) {
  console.error('Usage: npm run ww:validate <filename>.data')
  process.exit(1)
}

const rawDir = join(import.meta.dirname!, '..', 'data', 'raw')
const candidatePath = join(rawDir, candidateArg)
const candidateRaw = readFileSync(candidatePath, 'utf-8')

const baselineFiles = readdirSync(rawDir).filter((f) => f.endsWith('.data') && f !== candidateArg)
let baselineRaw = ''
for (const f of baselineFiles) baselineRaw += readFileSync(join(rawDir, f), 'utf-8') + '\n'

// ---- Parse both (capture parser warnings for the candidate only) ----

const originalWarn = console.warn
const candidateWarnings: string[] = []
console.warn = (...args: unknown[]) => {
  const msg = args.map(String).join(' ')
  if (msg.includes('[WandWars Parser]')) candidateWarnings.push(msg)
  else originalWarn(...args)
}

const baseline = parseMatchData(baselineRaw)
candidateWarnings.length = 0
const candidate = parseMatchData(candidateRaw)
console.warn = originalWarn

// ---- Stats helpers ----

interface DistStats {
  n: number
  decisive: number
  draws: number
  leftWins: number
  rightWins: number
  sweeps: number
  leftWinRate: number
  drawRate: number
  sweepRate: number
}

function distribution(matches: MatchResult[]): DistStats {
  const n = matches.length
  const decisive = matches.filter((m) => m.result !== 'draw').length
  const draws = n - decisive
  const leftWins = matches.filter((m) => m.result === 'left').length
  const rightWins = matches.filter((m) => m.result === 'right').length
  const sweeps = matches.filter((m) => m.weight >= 1.5).length
  return {
    n,
    decisive,
    draws,
    leftWins,
    rightWins,
    sweeps,
    leftWinRate: decisive > 0 ? leftWins / decisive : 0,
    drawRate: n > 0 ? draws / n : 0,
    sweepRate: n > 0 ? sweeps / n : 0,
  }
}

function heroWinRates(matches: MatchResult[]): Map<string, { wins: number; total: number }> {
  const stats = new Map<string, { wins: number; total: number }>()
  for (const m of matches) {
    if (m.result === 'draw') continue
    const winTeam = m.result === 'left' ? m.left : m.right
    const loseTeam = m.result === 'left' ? m.right : m.left
    for (const h of winTeam) {
      const s = stats.get(h) ?? { wins: 0, total: 0 }
      s.wins += m.weight
      s.total += m.weight
      stats.set(h, s)
    }
    for (const h of loseTeam) {
      const s = stats.get(h) ?? { wins: 0, total: 0 }
      s.total += m.weight
      stats.set(h, s)
    }
  }
  return stats
}

/**
 * Wilson 95% confidence interval for a binomial proportion. Returns [lower, upper].
 */
function wilsonInterval(wins: number, total: number): [number, number] {
  if (total === 0) return [0, 1]
  const z = 1.96
  const p = wins / total
  const denom = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denom
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

// ---- Run held-out prediction ----

interface PredPair {
  x: number
  y: number
}

function accuracy(pairs: PredPair[]): number {
  if (pairs.length === 0) return 0
  let correct = 0
  for (const p of pairs) if ((p.x >= 0.5 ? 1 : 0) === p.y) correct++
  return correct / pairs.length
}

function brier(pairs: PredPair[]): number {
  if (pairs.length === 0) return 0
  let sum = 0
  for (const p of pairs) sum += (p.x - p.y) * (p.x - p.y)
  return sum / pairs.length
}

// ---- Compute everything ----

const baseDist = distribution(baseline)
const candDist = distribution(candidate)

const baselineHeroes = new Set(getUniqueHeroes(baseline))
const candidateHeroes = new Set(getUniqueHeroes(candidate))
const newHeroes = [...candidateHeroes].filter((h) => !baselineHeroes.has(h))

// Run models trained on baseline against candidate matches
const allHeroList = getUniqueHeroes([...baseline, ...candidate])
const analysis = analyzeMatches(baseline, allHeroList)

function collect(modelFn: (m: MatchResult) => number): PredPair[] {
  const out: PredPair[] = []
  for (const m of candidate) {
    if (m.result === 'draw') continue
    out.push({ x: modelFn(m), y: m.result === 'left' ? 1 : 0 })
  }
  return out
}

const ppPairs = collect(
  (m) =>
    popularPickModel.predictMatchup([...m.left], [...m.right], analysis, baseline)
      .leftWinProbability,
)
const coPairs = collect(
  (m) =>
    compositeModel.predictMatchup([...m.left], [...m.right], analysis, baseline).leftWinProbability,
)
const btPairs = collect(
  (m) =>
    bradleyTerryModel.predictMatchup([...m.left], [...m.right], analysis, baseline)
      .leftWinProbability,
)

const avgAccuracy = (accuracy(ppPairs) + accuracy(coPairs) + accuracy(btPairs)) / 3

// Verdict — PASS/WARN/FAIL based on average accuracy vs. a baseline CV floor.
// WAND_WARS.md docs baseline CV ≈ 58%; we allow up to 5pp below before WARN.
const PASS_THRESHOLD = 0.55
const WARN_THRESHOLD = 0.48

type Verdict = 'PASS' | 'WARN' | 'FAIL'
let verdict: Verdict
let verdictLine: string

if (candidateWarnings.length > 0 || newHeroes.length > 0) {
  verdict = 'FAIL'
  verdictLine = '✗ FAIL — parse errors or unknown heroes. Fix before merging.'
} else if (avgAccuracy >= PASS_THRESHOLD) {
  verdict = 'PASS'
  verdictLine = `✓ PASS — models predict new data at ${(avgAccuracy * 100).toFixed(1)}% avg accuracy (baseline CV ~58%). Data behaves like baseline. Safe to merge.`
} else if (avgAccuracy >= WARN_THRESHOLD) {
  verdict = 'WARN'
  verdictLine = `⚠ WARN — predictability (${(avgAccuracy * 100).toFixed(1)}%) is close to coin-flip. New data may come from a different meta or recording style.`
} else {
  verdict = 'FAIL'
  verdictLine = `✗ FAIL — models predict only ${(avgAccuracy * 100).toFixed(1)}% — worse than an "always predict left" baseline. Likely mislabeled matches, check the winner column.`
}

// Per-hero statistically-notable shifts: Wilson intervals must not overlap.
const MIN_CANDIDATE_SAMPLES = 3
const MIN_BASELINE_SAMPLES = 10

const baselineRates = heroWinRates(baseline)
const candidateRates = heroWinRates(candidate)

type NotableShift = {
  hero: string
  baseRate: number
  baseTotal: number
  candRate: number
  candTotal: number
  delta: number
}
const notableShifts: NotableShift[] = []
let filteredBySampleSize = 0
let filteredByNoise = 0

for (const [hero, c] of candidateRates) {
  const b = baselineRates.get(hero)
  if (!b) continue
  if (c.total < MIN_CANDIDATE_SAMPLES || b.total < MIN_BASELINE_SAMPLES) {
    filteredBySampleSize++
    continue
  }
  const [bLo, bHi] = wilsonInterval(b.wins, b.total)
  const [cLo, cHi] = wilsonInterval(c.wins, c.total)
  // Intervals don't overlap → statistically distinct at ~95%
  const overlap = cLo <= bHi && bLo <= cHi
  const delta = c.wins / c.total - b.wins / b.total
  if (overlap) {
    if (Math.abs(delta) >= 0.25) filteredByNoise++
    continue
  }
  notableShifts.push({
    hero,
    baseRate: b.wins / b.total,
    baseTotal: b.total,
    candRate: c.wins / c.total,
    candTotal: c.total,
    delta,
  })
}
notableShifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

// ---- Render ----

function pp(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}

function pad(s: string, n: number): string {
  return s.padEnd(n)
}

console.log(`\n===== Validation: ${candidateArg} =====\n`)
console.log(verdictLine)
console.log()
console.log(`Baseline: ${baselineFiles.join(', ')} (${baseDist.n} matches)`)
console.log(`Candidate: ${candidateArg} (${candDist.n} matches, ${candDist.decisive} decisive)`)
console.log()

// Parse + coverage
if (candidateWarnings.length > 0) {
  console.log(`✗ Parser warnings:`)
  for (const w of candidateWarnings) console.log(`   ${w.replace('[WandWars Parser]', '').trim()}`)
} else {
  console.log(`✓ Parsing: no errors`)
}
if (newHeroes.length > 0) {
  console.log(`✗ Unknown heroes: ${newHeroes.join(', ')}  (typos? add to baseline if intentional)`)
} else {
  console.log(`✓ Hero coverage: all ${candidateHeroes.size} candidate heroes exist in baseline`)
}

// Distribution shifts — use Wilson interval containment so small-N doesn't
// falsely report tiny deltas (e.g. draw rate 0.0% vs 1.8% at n=32 is noise,
// not a "shift") and so any callout we do make is statistically grounded.
console.log(`\n----- Distribution -----`)
function driftNote(candCount: number, candN: number, baseRate: number, label: string): string {
  if (candN < 2) return `(insufficient data)`
  const [lo, hi] = wilsonInterval(candCount, candN)
  // If baseline rate falls inside the candidate's 95% CI, it's noise
  if (baseRate >= lo && baseRate <= hi) return `(sampling noise)`
  const delta = candCount / candN - baseRate
  const sign = delta >= 0 ? '+' : ''
  const pctPt = (delta * 100).toFixed(1)
  if (label === 'Sweep rate' && delta < 0) return `(${sign}${pctPt}pp — sweeps may be under-marked)`
  if (label === 'Sweep rate' && delta > 0)
    return `(${sign}${pctPt}pp — more decisive games than baseline)`
  return `(${sign}${pctPt}pp — outside baseline sampling range)`
}
console.log(
  `${pad('Left-win rate:', 18)} ${pp(candDist.leftWinRate).padStart(6)} vs ${pp(baseDist.leftWinRate).padStart(6)}  ${driftNote(candDist.leftWins, candDist.decisive, baseDist.leftWinRate, 'Left-win rate')}`,
)
console.log(
  `${pad('Draw rate:', 18)} ${pp(candDist.drawRate).padStart(6)} vs ${pp(baseDist.drawRate).padStart(6)}  ${driftNote(candDist.draws, candDist.n, baseDist.drawRate, 'Draw rate')}`,
)
console.log(
  `${pad('Sweep rate:', 18)} ${pp(candDist.sweepRate).padStart(6)} vs ${pp(baseDist.sweepRate).padStart(6)}  ${driftNote(candDist.sweeps, candDist.n, baseDist.sweepRate, 'Sweep rate')}`,
)

// Held-out prediction
console.log(`\n----- Held-out prediction -----`)
console.log(
  `(trained on baseline, predicting ${ppPairs.length} decisive candidate matches; baseline 5-fold CV ≈ 58%)\n`,
)
console.log('Model           Accuracy   Brier')
console.log('-------------   --------   ------')
function row(name: string, pairs: PredPair[]): void {
  console.log(`${pad(name, 13)}   ${pp(accuracy(pairs)).padStart(8)}   ${brier(pairs).toFixed(4)}`)
}
row('popular-pick', ppPairs)
row('composite', coPairs)
row('bradley-terry', btPairs)
console.log(`${pad('Average', 13)}   ${pp(avgAccuracy).padStart(8)}`)

// Per-hero notable shifts
console.log(`\n----- Per-hero shifts (statistically notable only) -----`)
if (notableShifts.length === 0) {
  console.log(`✓ No hero has a shift outside its baseline 95% Wilson interval.`)
} else {
  console.log(
    `${notableShifts.length} hero(es) with win rate outside baseline 95% interval — worth a sanity check:`,
  )
  console.log()
  console.log(`  hero            baseline         candidate        delta`)
  for (const s of notableShifts) {
    const sign = s.delta >= 0 ? '+' : ''
    console.log(
      `  ${pad(s.hero, 14)}  ${pp(s.baseRate).padStart(5)} (n=${s.baseTotal.toFixed(0).padStart(3)})  ${pp(s.candRate).padStart(6)} (n=${s.candTotal.toFixed(0).padStart(2)})   ${sign}${(s.delta * 100).toFixed(1)}pp`,
    )
  }
}
if (filteredByNoise > 0) {
  console.log(
    `\n(${filteredByNoise} additional hero(es) had raw delta ≥25% but fall within noise at their candidate sample size — not listed)`,
  )
}
if (filteredBySampleSize > 0) {
  console.log(`(${filteredBySampleSize} hero(es) had too few samples to judge — not listed)`)
}

console.log(`\n===== ${verdict} =====\n`)

process.exit(verdict === 'FAIL' ? 1 : 0)
