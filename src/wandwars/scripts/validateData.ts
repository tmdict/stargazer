/**
 * Sanity-check a new raw .data file against the existing baseline before
 * merging it into the training set. Compares parsing validity, hero
 * coverage, distribution stats (win rates, sweep rates, draws), per-hero
 * win-rate shifts, and runs a held-out prediction check (train models on
 * baseline, predict candidate, compare to 5-fold CV accuracy).
 *
 * Usage: npm run validate:ww <filename>.data
 *        tsx src/wandwars/scripts/validateData.ts <filename>.data
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
  console.error('Usage: tsx checkNewData.ts <filename>.data')
  process.exit(1)
}

const rawDir = join(import.meta.dirname!, '..', 'data', 'raw')
const candidatePath = join(rawDir, candidateArg)

const candidateRaw = readFileSync(candidatePath, 'utf-8')
const candidateRawLines = candidateRaw.split('\n').filter((l) => l.trim()).length

const baselineFiles = readdirSync(rawDir).filter((f) => f.endsWith('.data') && f !== candidateArg)
let baselineRaw = ''
for (const f of baselineFiles) baselineRaw += readFileSync(join(rawDir, f), 'utf-8') + '\n'

console.log(`\n===== Data validation: ${candidateArg} =====\n`)
console.log(`Baseline: ${baselineFiles.join(', ')}`)
console.log(`Candidate: ${candidateArg} (${candidateRawLines} non-empty lines on disk)\n`)

// ---- Parse both ----

// Silence the parser's own warnings to our stderr — we capture them ourselves
const originalWarn = console.warn
const candidateWarnings: string[] = []
console.warn = (...args: unknown[]) => {
  const msg = args.map(String).join(' ')
  if (msg.includes('[WandWars Parser]')) candidateWarnings.push(msg)
  else originalWarn(...args)
}

const baseline = parseMatchData(baselineRaw)
// Reset warnings, then capture only those from the candidate parse
candidateWarnings.length = 0
const candidate = parseMatchData(candidateRaw)
console.warn = originalWarn

if (candidateWarnings.length > 0) {
  console.log(`⚠️  Parser warnings for candidate:`)
  for (const w of candidateWarnings) console.log(`   ${w.replace('[WandWars Parser]', '').trim()}`)
  console.log()
}

// ---- Hero coverage check ----

const baselineHeroes = new Set(getUniqueHeroes(baseline))
const candidateHeroes = new Set(getUniqueHeroes(candidate))

const newHeroes = [...candidateHeroes].filter((h) => !baselineHeroes.has(h))
const unusedBaselineHeroes = [...baselineHeroes].filter((h) => !candidateHeroes.has(h))

console.log(`----- Hero coverage -----`)
console.log(`Baseline heroes: ${baselineHeroes.size}`)
console.log(`Candidate heroes: ${candidateHeroes.size}`)
if (newHeroes.length > 0) {
  console.log(`⚠️  Heroes in candidate but NOT in baseline: ${newHeroes.join(', ')}`)
  console.log(`   (If these are intentional new characters, fine. Otherwise typos to fix.)`)
} else {
  console.log(`✓ All candidate heroes exist in baseline.`)
}
console.log(
  `Heroes in baseline but not used in candidate: ${unusedBaselineHeroes.length}/${baselineHeroes.size}`,
)

// ---- Basic distribution stats ----

function summary(label: string, matches: MatchResult[]): void {
  const n = matches.length
  const decisive = matches.filter((m) => m.result !== 'draw').length
  const draws = n - decisive
  const leftWins = matches.filter((m) => m.result === 'left').length
  const rightWins = matches.filter((m) => m.result === 'right').length
  const sweeps = matches.filter((m) => m.weight >= 1.5).length
  const leftWinRate = decisive > 0 ? leftWins / decisive : 0

  console.log(`\n${label}:`)
  console.log(`  Matches: ${n}`)
  console.log(`  Decisive: ${decisive} (draws: ${draws}, ${((draws / n) * 100).toFixed(1)}%)`)
  console.log(
    `  Left/Right wins: ${leftWins} / ${rightWins}  → left win rate ${(leftWinRate * 100).toFixed(1)}%`,
  )
  console.log(`  Sweeps: ${sweeps} (${((sweeps / n) * 100).toFixed(1)}%)`)
}

console.log(`\n----- Distribution -----`)
summary('Baseline', baseline)
summary('Candidate', candidate)

// ---- Per-hero win rate shift (only for heroes in both sets) ----

function heroWinRates(matches: MatchResult[]): Map<string, { matches: number; wr: number }> {
  const stats = new Map<string, { w: number; n: number }>()
  for (const m of matches) {
    if (m.result === 'draw') continue
    const winTeam = m.result === 'left' ? m.left : m.right
    const loseTeam = m.result === 'left' ? m.right : m.left
    for (const h of winTeam) {
      const s = stats.get(h) ?? { w: 0, n: 0 }
      s.w += m.weight
      s.n += m.weight
      stats.set(h, s)
    }
    for (const h of loseTeam) {
      const s = stats.get(h) ?? { w: 0, n: 0 }
      s.n += m.weight
      stats.set(h, s)
    }
  }
  const out = new Map<string, { matches: number; wr: number }>()
  for (const [h, s] of stats) out.set(h, { matches: s.n, wr: s.n > 0 ? s.w / s.n : 0.5 })
  return out
}

const baselineRates = heroWinRates(baseline)
const candidateRates = heroWinRates(candidate)

// Flag heroes whose win rate shifted dramatically, with meaningful sample on both sides
const MIN_OCCURRENCES_CANDIDATE = 3
const MIN_OCCURRENCES_BASELINE = 10
const BIG_SHIFT = 0.25

type Shift = { hero: string; bwr: number; bn: number; cwr: number; cn: number; delta: number }
const shifts: Shift[] = []
for (const [hero, c] of candidateRates) {
  const b = baselineRates.get(hero)
  if (!b) continue
  if (c.matches < MIN_OCCURRENCES_CANDIDATE) continue
  if (b.matches < MIN_OCCURRENCES_BASELINE) continue
  const delta = c.wr - b.wr
  if (Math.abs(delta) >= BIG_SHIFT) {
    shifts.push({ hero, bwr: b.wr, bn: b.matches, cwr: c.wr, cn: c.matches, delta })
  }
}

console.log(`\n----- Per-hero win rate shift (candidate vs baseline) -----`)
if (shifts.length === 0) {
  console.log(
    `✓ No hero with ≥${BIG_SHIFT * 100}% win-rate shift (among heroes with ≥${MIN_OCCURRENCES_CANDIDATE} candidate + ≥${MIN_OCCURRENCES_BASELINE} baseline occurrences).`,
  )
} else {
  console.log(
    `⚠️  ${shifts.length} hero(es) with large win-rate shift — could indicate a meta change, or mislabeled matches:`,
  )
  for (const s of shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))) {
    const sign = s.delta >= 0 ? '+' : ''
    console.log(
      `  ${s.hero.padEnd(14)}  baseline ${(s.bwr * 100).toFixed(1)}% (n=${s.bn.toFixed(0)})  →  candidate ${(s.cwr * 100).toFixed(1)}% (n=${s.cn.toFixed(0)})   ${sign}${(s.delta * 100).toFixed(1)}%`,
    )
  }
}

// ---- Held-out prediction check ----
// Train models on baseline, predict candidate matches, compare to baseline CV.

console.log(`\n----- Held-out prediction check -----`)
console.log(`Training on baseline only, predicting candidate matches...`)

const baselineHeroList = getUniqueHeroes([...baseline, ...candidate])
const analysis = analyzeMatches(baseline, baselineHeroList)

interface PredPair {
  x: number
  y: number
}

function collect(modelFn: (m: MatchResult) => number): PredPair[] {
  const out: PredPair[] = []
  for (const m of candidate) {
    if (m.result === 'draw') continue
    const prob = modelFn(m)
    out.push({ x: prob, y: m.result === 'left' ? 1 : 0 })
  }
  return out
}

function accuracy(pairs: PredPair[]): number {
  if (pairs.length === 0) return 0
  let correct = 0
  for (const p of pairs) {
    const pred = p.x >= 0.5 ? 1 : 0
    if (pred === p.y) correct++
  }
  return correct / pairs.length
}

function brierScore(pairs: PredPair[]): number {
  if (pairs.length === 0) return 0
  let sum = 0
  for (const p of pairs) sum += (p.x - p.y) * (p.x - p.y)
  return sum / pairs.length
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

const decisiveCandidate = candidate.filter((m) => m.result !== 'draw').length
console.log(
  `(${decisiveCandidate} decisive candidate matches predicted; baseline 5-fold CV accuracy ≈ 58% per WAND_WARS.md)\n`,
)
console.log('Model           Accuracy   Brier     Notes')
console.log('-------------   --------   -------   ----------------------------------')
function row(name: string, pairs: PredPair[]) {
  const acc = accuracy(pairs)
  const br = brierScore(pairs)
  const note =
    acc < 0.45 ? 'much worse than CV — investigate' : acc < 0.55 ? 'below CV average' : ''
  console.log(
    `${name.padEnd(13)}   ${(acc * 100).toFixed(1).padStart(7)}%   ${br.toFixed(4)}   ${note}`,
  )
}
row('popular-pick', ppPairs)
row('composite', coPairs)
row('bradley-terry', btPairs)

const leftFavored = candidate.filter((m) => m.result === 'left').length
const rightFavored = candidate.filter((m) => m.result === 'right').length
const baselineDecisive = baseline.filter((m) => m.result !== 'draw')
const baselineLeftRate =
  baselineDecisive.filter((m) => m.result === 'left').length / baselineDecisive.length
console.log(
  `\nBaseline rate  ${(baselineLeftRate * 100).toFixed(1).padStart(7)}%   —         (always-predict-left baseline)`,
)
console.log(
  `Candidate skew ${((leftFavored / (leftFavored + rightFavored)) * 100).toFixed(1).padStart(7)}%   —         (new data's left win rate)`,
)

console.log(`\n===== Summary =====`)
const hasShifts = shifts.length > 0
const hasNewHeroes = newHeroes.length > 0
const hasParseIssues = candidateWarnings.length > 0
if (!hasShifts && !hasNewHeroes && !hasParseIssues) {
  console.log(`✓ New data looks consistent with baseline. Safe to merge.`)
} else {
  console.log(`⚠️  Review the flags above before merging:`)
  if (hasParseIssues) console.log(`   - Parser warnings (${candidateWarnings.length})`)
  if (hasNewHeroes) console.log(`   - Unknown/new heroes: ${newHeroes.join(', ')}`)
  if (hasShifts)
    console.log(`   - ${shifts.length} hero(es) with ≥${BIG_SHIFT * 100}% win-rate shift`)
}
console.log()
