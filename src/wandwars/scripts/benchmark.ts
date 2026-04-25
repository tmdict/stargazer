/**
 * 5-fold cross-validation benchmark + probability calibration fit.
 *
 * For each fold:
 *   - Hide the fold from training
 *   - Train NN from scratch on the other 4 folds (per-fold retrain for honest NN calibration)
 *   - Build analysis data from the other 4 folds
 *   - Predict each held-out match via all 4 models
 *
 * After all folds:
 *   - Fit isotonic regression (or Platt if data < MIN_ISOTONIC_SAMPLES) per model
 *   - Tune confidence thresholds so "high" predictions hit >= HIGH_TARGET_ACC on CV
 *   - Write `calibrationData.ts`
 *   - Print benchmark table + reliability diagnostics (pre/post calibration)
 */

import { writeFileSync } from 'fs'
import { join } from 'path'

import { getAdaptiveAggregateWeights } from '../constants'
import { analyzeMatches } from '../prediction/analysis'
import { fitBradleyTerry } from '../prediction/bradleyTerry'
import { isotonicApply, plattApply } from '../prediction/calibration'
import { compositeModel } from '../prediction/composite'
import { computeAllSelfConfidences } from '../prediction/modelConfidence'
import { popularPickModel } from '../prediction/popularPick'
import type { MatchResult, RecommendationModel } from '../types'
import { buildSamples, forwardPredict, trainRun, type TrainingSample } from './trainNNCore'

const NUM_FOLDS = 5
const FOLD_SEED = 42
const NN_FOLD_SEED_BASE = 1000
const MIN_ISOTONIC_SAMPLES = 300
const MIN_CALIBRATION_SAMPLES = 100
const TARGET_BINS = 12

/**
 * Confidence threshold tuning — data-driven, no hardcoded accuracy targets.
 *
 * The tuner picks cutoffs on each model's self-confidence distribution (and
 * on `(stddev, avgSelfConf)` pairs for the aggregate) that satisfy three
 * empirical criteria:
 *
 *   1. MEDIUM: prefer the cutoff whose LOW coverage is closest to
 *      `TARGET_LOW_COVERAGE` among all cutoffs where the sub-bucket is
 *      ≥ LOW_DROP_BELOW_MEDIUM less accurate than the above-bucket (the
 *      "LOW is justified" check). Must also clear an absolute accuracy
 *      floor and a minimum coverage floor.
 *   2. HIGH: strictly tighter than MEDIUM's cutoff. Above-bucket accuracy
 *      must clear `overall_acc + HIGH_LIFT_OVER_OVERALL` *and* MEDIUM's
 *      own accuracy (so HIGH > MEDIUM > LOW ordering is preserved).
 *      Coverage capped at HIGH_MAX_COVERAGE so HIGH stays genuinely rare.
 *   3. Relabel: if LOW would be the majority (> LOW_INVERT_THRESHOLD) and
 *      no HIGH bucket was found, but the above-bucket itself passes the
 *      HIGH lift criterion, swap the framing: above → HIGH, below →
 *      MEDIUM, no LOW. Covers signals that split bimodally (B-T's pair
 *      residuals).
 *
 * Each band is disabled (HIGH → unreachable cutoff 1.01; LOW → collapsed
 * MEDIUM cutoff 0) if no candidate satisfies its criterion. We'd rather
 * skip a band than show one that's wrong 35% of the time.
 *
 * Only the *deltas* here are constants. Absolute accuracy bars self-adjust
 * per run: HIGH target tracks realized overall accuracy, LOW target tracks
 * realized MEDIUM accuracy. No manual retuning as the dataset grows.
 */
const PER_MODEL_HIGH_LIFT_OVER_OVERALL = 0.02 // HIGH must beat overall by ≥ 2pp
const PER_MODEL_LOW_DROP_BELOW_MEDIUM = 0.01 // LOW must fall ≥ 1pp below MEDIUM
const PER_MODEL_HIGH_MIN_COVERAGE = 0.03
const PER_MODEL_HIGH_MAX_COVERAGE = 0.15 // HIGH stays genuinely rare (< 15%)
const PER_MODEL_MEDIUM_TARGET_ACC = 0.55
const PER_MODEL_MEDIUM_MIN_COVERAGE = 0.3

// Aggregate is already smoothing across models. Keep LOW drop small (1pp)
// so the bottom warning tier enables at realistic data sizes. HIGH lift
// matches per-model (2pp) — marginal 0.2pp-over-MEDIUM "HIGH" tiers are
// within run-variance and would flicker on/off, so require the same
// meaningful lift as individual models.
const AGGREGATE_HIGH_LIFT_OVER_OVERALL = 0.02 // match per-model — HIGH must meaningfully beat overall
const AGGREGATE_LOW_DROP_BELOW_MEDIUM = 0.01
const AGGREGATE_HIGH_MIN_COVERAGE = 0.02
const AGGREGATE_HIGH_MAX_COVERAGE = 0.15
const AGGREGATE_MEDIUM_TARGET_ACC = 0.58
const AGGREGATE_MEDIUM_MIN_COVERAGE = 0.3

// UX preferences — applied on top of the statistical constraints above.
// Every candidate cutoff considered already passed the statistical checks,
// so the selected cutoff remains empirically justified.
const TARGET_LOW_COVERAGE = 0.25 // preferred LOW coverage share
const LOW_INVERT_THRESHOLD = 0.5 // above this, trigger HIGH+MEDIUM relabel

const MODEL_IDS = ['popular-pick', 'composite', 'bradley-terry', 'adaptive-ml'] as const

// ---- seeded RNG for fold shuffling (independent of trainNNCore's RNG) ----
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const rng = seededRandom(seed)
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

// ---- Pool Adjacent Violators (PAV) for isotonic regression ----

interface PAVBlock {
  sumX: number
  sumY: number
  weight: number
}

function isotonicRegression(
  pairs: { x: number; y: number }[],
): { rawProb: number; calibratedProb: number }[] {
  if (pairs.length === 0) return []
  // Sort by x ascending
  const sorted = [...pairs].sort((a, b) => a.x - b.x)
  const blocks: PAVBlock[] = sorted.map((p) => ({ sumX: p.x, sumY: p.y, weight: 1 }))

  // Merge adjacent blocks while non-monotonic
  let i = 0
  while (i < blocks.length - 1) {
    const curMean = blocks[i]!.sumY / blocks[i]!.weight
    const nextMean = blocks[i + 1]!.sumY / blocks[i + 1]!.weight
    if (curMean > nextMean) {
      // Merge i+1 into i
      blocks[i]!.sumX += blocks[i + 1]!.sumX
      blocks[i]!.sumY += blocks[i + 1]!.sumY
      blocks[i]!.weight += blocks[i + 1]!.weight
      blocks.splice(i + 1, 1)
      if (i > 0) i--
    } else {
      i++
    }
  }

  const result = blocks.map((b) => ({
    rawProb: b.sumX / b.weight,
    calibratedProb: b.sumY / b.weight,
  }))

  // Downsample to at most TARGET_BINS for stability and a compact lookup table
  if (result.length <= TARGET_BINS) return result
  const step = result.length / TARGET_BINS
  const downsampled: { rawProb: number; calibratedProb: number }[] = []
  for (let k = 0; k < TARGET_BINS; k++) {
    const idx = Math.min(result.length - 1, Math.floor(k * step))
    downsampled.push(result[idx]!)
  }
  // Always include the endpoints
  if (downsampled[0] !== result[0]) downsampled[0] = result[0]!
  downsampled[downsampled.length - 1] = result[result.length - 1]!
  return downsampled
}

// ---- Platt scaling fallback (for small datasets) ----
// Runtime application lives in calibration.ts (`plattApply`); this fits the
// two coefficients via gradient descent on BCE. For pred = 1 / (1 + exp(z))
// with z = a*x + b, dL/dz = y − pred, so the per-sample gradient is
// dL/da = (y − pred) * x and dL/db = (y − pred).
function fitPlatt(pairs: { x: number; y: number }[]): { a: number; b: number } {
  let a = 0
  let b = 0
  const lr = 0.1
  const epochs = 500
  const n = pairs.length
  for (let ep = 0; ep < epochs; ep++) {
    let dA = 0
    let dB = 0
    for (const p of pairs) {
      const z = a * p.x + b
      const pred = 1 / (1 + Math.exp(z))
      const diff = pred - p.y
      dA += -p.x * diff
      dB += -diff
    }
    a -= (lr * dA) / n
    b -= (lr * dB) / n
  }
  return { a, b }
}

// ---- Metrics ----

function brierScore(pairs: { x: number; y: number }[]): number {
  if (pairs.length === 0) return 0
  let sum = 0
  for (const p of pairs) sum += (p.x - p.y) * (p.x - p.y)
  return sum / pairs.length
}

function accuracy(pairs: { x: number; y: number }[]): number {
  if (pairs.length === 0) return 0
  let correct = 0
  let total = 0
  for (const p of pairs) {
    if (p.y === 0.5) continue
    total++
    const predicted = p.x >= 0.5 ? 1 : 0
    if (predicted === p.y) correct++
  }
  return total > 0 ? correct / total : 0
}

function reliabilityDiagram(pairs: { x: number; y: number }[], numBins: number = 10): string {
  const bins: { count: number; sumPred: number; sumActual: number }[] = Array.from(
    { length: numBins },
    () => ({ count: 0, sumPred: 0, sumActual: 0 }),
  )
  for (const p of pairs) {
    const idx = Math.min(numBins - 1, Math.floor(p.x * numBins))
    bins[idx]!.count++
    bins[idx]!.sumPred += p.x
    bins[idx]!.sumActual += p.y
  }
  const lines: string[] = []
  lines.push('    bin       n  predicted   actual   gap')
  for (let i = 0; i < numBins; i++) {
    const b = bins[i]!
    if (b.count === 0) continue
    const pred = b.sumPred / b.count
    const actual = b.sumActual / b.count
    const gap = actual - pred
    lines.push(
      `  ${(i / numBins).toFixed(1)}-${((i + 1) / numBins).toFixed(1)}  ${String(b.count).padStart(4)}    ${(pred * 100).toFixed(1)}%   ${(actual * 100).toFixed(1)}%   ${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}%`,
    )
  }
  return lines.join('\n')
}

// ---- Confidence threshold tuning ----

interface PerModelTuned {
  high: number // selfConf cutoff; 1.01 = disabled
  medium: number // selfConf cutoff; 0 = always medium (no LOW)
  highAcc: number
  highCoverage: number
  mediumAcc: number
  mediumCoverage: number
  lowAcc: number // realized accuracy of predictions with selfConf < medium
  lowCoverage: number
}

interface AggregateTuned {
  highStddev: number
  highAvgSelfConf: number
  mediumStddev: number
  mediumAvgSelfConf: number
  highAcc: number
  highCoverage: number
  mediumAcc: number
  mediumCoverage: number
  lowAcc: number
  lowCoverage: number
}

/**
 * Grid of self-confidence cutoff candidates, descending. Each model publishes
 * selfConf ∈ [0, 1]; we pick thresholds from this grid. Finer resolution at
 * the top end (0.95 → 0.99) gives the HIGH picker more options to hit the
 * ≤ 15% max-coverage cap — some signals (PP's avg pair match count, NN's
 * avg pair co-occurrence) saturate near 1.0 so 0.95 alone would sweep up
 * 30 %+ of predictions.
 */
const SELF_CONF_GRID = [
  0.99, 0.98, 0.97, 0.96, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35,
  0.3, 0.25, 0.2, 0.15, 0.1, 0.05,
]

/**
 * Find per-model high/medium cutoffs on each model's own (selfConf, correct)
 * distribution. For each candidate cutoff T, predictions with selfConf >= T
 * form a bucket; we want the bucket's accuracy and coverage to clear the
 * target + floor. Prefer the lowest T that still passes (more coverage).
 */
function tunePerModel(
  pairs: { selfConf: number; actual: number; predicted: number }[],
  overallAcc: number,
): PerModelTuned {
  /** Accuracy/coverage of predictions with selfConf >= cutoff. */
  function bucketAbove(cutoff: number): { acc: number; coverage: number; n: number } {
    const subset = pairs.filter((p) => p.actual !== 0.5 && p.selfConf >= cutoff)
    if (subset.length === 0) return { acc: 0, coverage: 0, n: 0 }
    let correct = 0
    for (const p of subset) if (p.predicted === p.actual) correct++
    return {
      acc: correct / subset.length,
      coverage: subset.length / pairs.length,
      n: subset.length,
    }
  }

  /** Accuracy/coverage of predictions with selfConf < cutoff (the LOW bucket). */
  function bucketBelow(cutoff: number): { acc: number; coverage: number; n: number } {
    const subset = pairs.filter((p) => p.actual !== 0.5 && p.selfConf < cutoff)
    if (subset.length === 0) return { acc: 0, coverage: 0, n: 0 }
    let correct = 0
    for (const p of subset) if (p.predicted === p.actual) correct++
    return {
      acc: correct / subset.length,
      coverage: subset.length / pairs.length,
      n: subset.length,
    }
  }

  // MEDIUM tuning — among all cutoffs that (a) meet the accuracy floor and
  // (b) have a statistically-justified LOW drop, pick the one whose LOW
  // coverage is closest to TARGET_LOW_COVERAGE. This keeps LOW meaningful
  // (neither vanishingly rare nor overwhelming) while staying empirically
  // justified.
  //
  // If no cutoff satisfies (b), fall back to plain max-coverage — LOW just
  // won't appear because the signal doesn't correlate with accuracy at the
  // bottom. Never fabricate LOW.
  let mediumPicked: {
    cutoff: number
    above: ReturnType<typeof bucketAbove>
    below: ReturnType<typeof bucketBelow>
  } | null = null
  let mediumPickedDistance = Infinity
  let mediumFallback: {
    cutoff: number
    above: ReturnType<typeof bucketAbove>
    below: ReturnType<typeof bucketBelow>
  } | null = null
  for (const T of SELF_CONF_GRID) {
    const above = bucketAbove(T)
    const below = bucketBelow(T)
    if (above.n < 20) continue
    if (above.acc < PER_MODEL_MEDIUM_TARGET_ACC) continue
    if (above.coverage < PER_MODEL_MEDIUM_MIN_COVERAGE) continue
    // Track a fallback candidate in case the stricter LOW-drop check fails
    if (!mediumFallback || above.coverage > mediumFallback.above.coverage) {
      mediumFallback = { cutoff: T, above, below }
    }
    // Prefer cutoffs that justify LOW — below-bucket has ≥ drop threshold AND ≥ 20 samples
    if (below.n >= 20 && above.acc - below.acc >= PER_MODEL_LOW_DROP_BELOW_MEDIUM) {
      const distance = Math.abs(below.coverage - TARGET_LOW_COVERAGE)
      if (distance < mediumPickedDistance) {
        mediumPicked = { cutoff: T, above, below }
        mediumPickedDistance = distance
      }
    }
  }
  const medium = mediumPicked ?? mediumFallback

  // HIGH: target accuracy = overall held-out accuracy + lift delta. HIGH
  // bucket must ALSO clear MEDIUM's accuracy so HIGH > MEDIUM > LOW is
  // preserved (if MEDIUM's cutoff happens to lift its subset above the
  // overall-based HIGH target, the acc-ordering guard keeps the ordering
  // honest). If no bucket clears both, HIGH disables.
  const highTargetAcc = overallAcc + PER_MODEL_HIGH_LIFT_OVER_OVERALL
  const mediumAccGuard = medium?.above.acc ?? 0
  let highPicked: { cutoff: number; acc: number; coverage: number } | null = null
  for (const T of SELF_CONF_GRID) {
    if (medium && T <= medium.cutoff) continue
    const r = bucketAbove(T)
    if (r.n < 20) continue
    if (r.acc < highTargetAcc) continue
    if (r.acc < mediumAccGuard) continue
    if (r.coverage < PER_MODEL_HIGH_MIN_COVERAGE) continue
    if (r.coverage > PER_MODEL_HIGH_MAX_COVERAGE) continue
    if (!highPicked || r.acc > highPicked.acc) {
      highPicked = { cutoff: T, acc: r.acc, coverage: r.coverage }
    }
  }

  // Relabel: if the best MEDIUM+LOW split puts > LOW_INVERT_THRESHOLD of
  // predictions in LOW AND the above-bucket passes HIGH's overall-acc +
  // lift criterion, the signal is really identifying a reliable top subset.
  // Swap framing: above → HIGH, below → MEDIUM, no LOW. Same statistically
  // justified split, different labels.
  if (
    mediumPicked &&
    !highPicked &&
    mediumPicked.below.coverage > LOW_INVERT_THRESHOLD &&
    mediumPicked.above.acc >= overallAcc + PER_MODEL_HIGH_LIFT_OVER_OVERALL
  ) {
    return {
      high: mediumPicked.cutoff,
      medium: 0,
      highAcc: mediumPicked.above.acc,
      highCoverage: mediumPicked.above.coverage,
      mediumAcc: mediumPicked.below.acc,
      mediumCoverage: mediumPicked.below.coverage,
      lowAcc: 0,
      lowCoverage: 0,
    }
  }

  // Default framing — MEDIUM+LOW. Runtime MEDIUM cutoff only > 0 when LOW
  // is empirically justified; otherwise 0 and no LOW shows. The fallback
  // stats are diagnostic-only.
  const runtimeMediumCutoff = mediumPicked?.cutoff ?? 0
  return {
    high: highPicked?.cutoff ?? 1.01,
    medium: runtimeMediumCutoff,
    highAcc: highPicked?.acc ?? 0,
    highCoverage: highPicked?.coverage ?? 0,
    mediumAcc: medium?.above.acc ?? 0,
    mediumCoverage: medium?.above.coverage ?? 0,
    lowAcc: medium?.below.acc ?? 0,
    lowCoverage: medium?.below.coverage ?? 0,
  }
}

/**
 * Aggregate tuning: grid-search (weighted_stddev, avg_self_conf) pairs. A
 * matchup clears "high" when stddev ≤ cutoffStddev AND avgSelfConf ≥ cutoff.
 * Prefer permissive cutoffs that still meet target accuracy + coverage.
 */
function tuneAggregate(
  pairs: { weightedStddev: number; avgSelfConf: number; actual: number; predicted: number }[],
  overallAcc: number,
): AggregateTuned {
  // Extended top-end resolution (stddev 0.01–0.03, selfConf 0.8–0.9) lets
  // the HIGH picker find very-tight-agreement / high-confidence subsets.
  // Those stricter cutoffs still have to clear the lift + coverage floors;
  // if no subset at the extreme end genuinely beats overall + 2pp AND
  // MEDIUM's acc, HIGH stays disabled honestly.
  const stddevGrid = [0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2]
  const selfConfGrid = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]

  function bucket(stdT: number, confT: number): { acc: number; coverage: number; n: number } {
    const subset = pairs.filter(
      (p) => p.actual !== 0.5 && p.weightedStddev <= stdT && p.avgSelfConf >= confT,
    )
    if (subset.length === 0) return { acc: 0, coverage: 0, n: 0 }
    let correct = 0
    for (const p of subset) if (p.predicted === p.actual) correct++
    return {
      acc: correct / subset.length,
      coverage: subset.length / pairs.length,
      n: subset.length,
    }
  }

  function pickBest(options: {
    targetAcc: number
    minCoverage: number
    maxCoverage?: number
    prefer: 'accuracy' | 'coverage'
    strictlyTighterThan?: { std: number; conf: number }
  }): { std: number; conf: number; acc: number; coverage: number } | null {
    let found: { std: number; conf: number; acc: number; coverage: number } | null = null
    for (const std of stddevGrid) {
      for (const conf of selfConfGrid) {
        // "strictlyTighterThan" ensures HIGH's cutoffs are at least as strict
        // as MEDIUM's in both dims AND stricter in at least one — so every
        // HIGH prediction also passes MEDIUM (HIGH ⊂ MEDIUM).
        if (options.strictlyTighterThan) {
          const t = options.strictlyTighterThan
          if (std > t.std || conf < t.conf) continue
          if (std === t.std && conf === t.conf) continue // must be stricter in ≥1 dim
        }
        const r = bucket(std, conf)
        if (r.n < 20) continue
        if (r.acc < options.targetAcc || r.coverage < options.minCoverage) continue
        if (options.maxCoverage !== undefined && r.coverage > options.maxCoverage) continue
        const better =
          !found ||
          (options.prefer === 'accuracy' ? r.acc > found.acc : r.coverage > found.coverage)
        if (better) found = { std, conf, acc: r.acc, coverage: r.coverage }
      }
    }
    return found
  }

  /** Accuracy/coverage of the complement bucket (predictions NOT in above). */
  function complementBucket(
    stdT: number,
    confT: number,
  ): { acc: number; coverage: number; n: number } {
    const subset = pairs.filter(
      (p) => p.actual !== 0.5 && !(p.weightedStddev <= stdT && p.avgSelfConf >= confT),
    )
    if (subset.length === 0) return { acc: 0, coverage: 0, n: 0 }
    let correct = 0
    for (const p of subset) if (p.predicted === p.actual) correct++
    return {
      acc: correct / subset.length,
      coverage: subset.length / pairs.length,
      n: subset.length,
    }
  }

  // MEDIUM tuning — prefer max coverage that (a) meets accuracy floor,
  // (b) below-bucket is meaningfully less accurate (justifies a LOW band).
  // If no cutoff satisfies (b), fall back to plain max-coverage — LOW
  // won't show because the signal doesn't correlate at the bottom.
  let mediumPicked: {
    std: number
    conf: number
    above: { acc: number; coverage: number; n: number }
    below: { acc: number; coverage: number; n: number }
  } | null = null
  let mediumPickedDistance = Infinity
  let mediumFallback: typeof mediumPicked = null
  for (const std of stddevGrid) {
    for (const conf of selfConfGrid) {
      const above = bucket(std, conf)
      const below = complementBucket(std, conf)
      if (above.n < 20) continue
      if (above.acc < AGGREGATE_MEDIUM_TARGET_ACC) continue
      if (above.coverage < AGGREGATE_MEDIUM_MIN_COVERAGE) continue
      if (!mediumFallback || above.coverage > mediumFallback.above.coverage) {
        mediumFallback = { std, conf, above, below }
      }
      if (below.n >= 20 && above.acc - below.acc >= AGGREGATE_LOW_DROP_BELOW_MEDIUM) {
        // Pick cutoff whose LOW coverage is closest to the target band.
        const distance = Math.abs(below.coverage - TARGET_LOW_COVERAGE)
        if (distance < mediumPickedDistance) {
          mediumPicked = { std, conf, above, below }
          mediumPickedDistance = distance
        }
      }
    }
  }
  const medium = mediumPicked ?? mediumFallback

  // HIGH target = overall aggregate accuracy + lift. HIGH must also clear
  // MEDIUM's accuracy to preserve HIGH > MEDIUM > LOW ordering. Strictly
  // tighter than MEDIUM in the (stddev, selfConf) grid.
  const highTargetAcc = Math.max(
    overallAcc + AGGREGATE_HIGH_LIFT_OVER_OVERALL,
    medium?.above.acc ?? 0,
  )
  const high = pickBest({
    targetAcc: highTargetAcc,
    minCoverage: AGGREGATE_HIGH_MIN_COVERAGE,
    maxCoverage: AGGREGATE_HIGH_MAX_COVERAGE,
    prefer: 'accuracy',
    strictlyTighterThan: medium ? { std: medium.std, conf: medium.conf } : undefined,
  })

  // Relabel: if the best MEDIUM+LOW split puts > LOW_INVERT_THRESHOLD in
  // LOW AND the above-bucket passes HIGH's overall-acc + lift criterion,
  // relabel — above-bucket becomes HIGH, below-bucket becomes MEDIUM, no
  // LOW. Same statistically justified split, different framing.
  if (
    mediumPicked &&
    !high &&
    mediumPicked.below.coverage > LOW_INVERT_THRESHOLD &&
    mediumPicked.above.acc >= overallAcc + AGGREGATE_HIGH_LIFT_OVER_OVERALL
  ) {
    return {
      highStddev: mediumPicked.std,
      highAvgSelfConf: mediumPicked.conf,
      mediumStddev: 1, // permissive — everything not HIGH becomes MEDIUM
      mediumAvgSelfConf: 0,
      highAcc: mediumPicked.above.acc,
      highCoverage: mediumPicked.above.coverage,
      mediumAcc: mediumPicked.below.acc,
      mediumCoverage: mediumPicked.below.coverage,
      lowAcc: 0,
      lowCoverage: 0,
    }
  }

  // Default framing — MEDIUM+LOW. Runtime MEDIUM thresholds only active
  // when LOW is justified. Otherwise permissive (everything = MEDIUM).
  const runtimeMediumStddev = mediumPicked?.std ?? 1
  const runtimeMediumAvgSelfConf = mediumPicked?.conf ?? 0
  return {
    highStddev: high?.std ?? 0,
    highAvgSelfConf: high?.conf ?? 1.01,
    mediumStddev: runtimeMediumStddev,
    mediumAvgSelfConf: runtimeMediumAvgSelfConf,
    highAcc: high?.acc ?? 0,
    highCoverage: high?.coverage ?? 0,
    mediumAcc: medium?.above.acc ?? 0,
    mediumCoverage: medium?.above.coverage ?? 0,
    lowAcc: medium?.below.acc ?? 0,
    lowCoverage: medium?.below.coverage ?? 0,
  }
}

// ---- Main CV loop ----

// Popular Pick and Composite read per-fold analysisData but don't refit
// anything heavy inside predictMatchup, so per-match predictMatchup is fine.
// Bradley-Terry and Adaptive ML both need explicit per-fold caching — see
// the fold loop below.
const LIGHT_MODELS: { id: string; model: RecommendationModel }[] = [
  { id: 'popular-pick', model: popularPickModel },
  { id: 'composite', model: compositeModel },
]

export function runBenchmarkAndCalibrate(allMatches: MatchResult[], allHeroes: string[]): void {
  const heroIndex: Record<string, number> = {}
  allHeroes.forEach((h, i) => (heroIndex[h] = i))

  // Filter to decisive matches for CV (draws still used in training data)
  const decisive = allMatches.filter((m) => m.result !== 'draw')
  const shuffled = shuffleWithSeed(decisive, FOLD_SEED)
  const foldSize = Math.floor(shuffled.length / NUM_FOLDS)

  console.log(
    `Matches: ${allMatches.length} total, ${decisive.length} decisive (excluded ${allMatches.length - decisive.length} draws)`,
  )
  console.log(`Fold size: ~${foldSize} matches each\n`)

  // Collect per-model predictions: { modelId: [{x: pred, y: actual}] }
  const rawPairs: Record<string, { x: number; y: number }[]> = {
    'popular-pick': [],
    composite: [],
    'bradley-terry': [],
    'adaptive-ml': [],
  }

  // Full per-match snapshot for aggregate + per-model tuning. Each entry
  // carries every model's raw probability AND self-confidence signal for
  // the held-out match, so the tuner can grid-search all four axes.
  const aggregateData: {
    modelProbs: Record<string, number>
    modelSelfConf: Record<string, number>
    actual: number
  }[] = []

  for (let fold = 0; fold < NUM_FOLDS; fold++) {
    const start = fold * foldSize
    const end = fold === NUM_FOLDS - 1 ? shuffled.length : (fold + 1) * foldSize
    const testMatches = shuffled.slice(start, end)
    const trainMatchesDecisive = [...shuffled.slice(0, start), ...shuffled.slice(end)]
    const draws = allMatches.filter((m) => m.result === 'draw')
    const trainMatches = [...trainMatchesDecisive, ...draws]

    // Build analysis from fold-train for non-NN models
    const foldAnalysis = analyzeMatches(trainMatches, allHeroes)

    process.stdout.write(`Fold ${fold + 1}/${NUM_FOLDS}: `)

    // Fit Bradley-Terry once per fold (strengths + pair interactions).
    // Reusing across all test-match predictions in this fold replaces ~225
    // redundant refits with one — the dominant phase-2 speedup.
    const btStart = Date.now()
    const btFit = fitBradleyTerry(trainMatches, foldAnalysis)
    const btTime = ((Date.now() - btStart) / 1000).toFixed(2)

    // Train NN from scratch on fold-train
    const trainStart = Date.now()
    const trainSamples = buildSamples(trainMatches, heroIndex)
    const foldRun = trainRun(trainSamples, allHeroes.length, {
      seed: NN_FOLD_SEED_BASE + fold * 9973,
      verbose: false,
    })
    const nnTime = ((Date.now() - trainStart) / 1000).toFixed(2)
    process.stdout.write(`BT fit ${btTime}s, NN train ${nnTime}s, `)

    // Predict on held-out test matches
    for (const match of testMatches) {
      const actual = match.result === 'left' ? 1 : 0
      const modelProbs: Record<string, number> = {}

      // Popular Pick + Composite via their normal predictMatchup (analysis
      // cached in foldAnalysis already; per-call cost is linear in team size).
      for (const { id, model } of LIGHT_MODELS) {
        const pred = model.predictMatchup(
          [...match.left],
          [...match.right],
          foldAnalysis,
          trainMatches,
        )
        rawPairs[id]!.push({ x: pred.leftWinProbability, y: actual })
        modelProbs[id] = pred.leftWinProbability
      }

      // Bradley-Terry via cached fit — no refit per match.
      const btProb = btFit.predict([...match.left], [...match.right])
      rawPairs['bradley-terry']!.push({ x: btProb, y: actual })
      modelProbs['bradley-terry'] = btProb

      // Adaptive ML prediction via inline forward
      const sample: TrainingSample = {
        leftIndices: match.left.map((h) => heroIndex[h]!),
        rightIndices: match.right.map((h) => heroIndex[h]!),
        target: actual,
        weight: match.weight,
      }
      const nnProb = forwardPredict(foldRun.params, sample)
      rawPairs['adaptive-ml']!.push({ x: nnProb, y: actual })
      modelProbs['adaptive-ml'] = nnProb

      // Self-confidence: each model's own data-support signal for this
      // matchup, computed against the fold's training-set analysis (so we
      // don't leak test-set info into per-model confidence).
      const modelSelfConf = computeAllSelfConfidences(
        [...match.left],
        [...match.right],
        foldAnalysis,
        btFit,
      )

      aggregateData.push({ modelProbs, modelSelfConf, actual })
    }

    process.stdout.write(`${testMatches.length} predictions\n`)
  }

  // ---- Fit calibration per model ----

  const calibrations: Record<
    string,
    {
      method: 'identity' | 'isotonic' | 'platt'
      bins?: { rawProb: number; calibratedProb: number }[]
      platt?: { a: number; b: number }
      brierRaw: number
      brierCalibrated: number
      accuracy: number
      samples: number
    }
  > = {}

  console.log(`\n----- Calibration fit -----`)
  for (const id of Object.keys(rawPairs)) {
    const pairs = rawPairs[id]!
    const brierRaw = brierScore(pairs)
    const acc = accuracy(pairs)

    let method: 'identity' | 'isotonic' | 'platt' = 'identity'
    let bins: { rawProb: number; calibratedProb: number }[] | undefined
    let platt: { a: number; b: number } | undefined
    let calibratedPairs = pairs

    if (pairs.length >= MIN_ISOTONIC_SAMPLES) {
      method = 'isotonic'
      bins = isotonicRegression(pairs)
      calibratedPairs = pairs.map((p) => ({ x: isotonicApply(bins!, p.x), y: p.y }))
    } else if (pairs.length >= MIN_CALIBRATION_SAMPLES) {
      method = 'platt'
      platt = fitPlatt(pairs)
      calibratedPairs = pairs.map((p) => ({
        x: plattApply(platt!.a, platt!.b, p.x),
        y: p.y,
      }))
    }

    const brierCal = brierScore(calibratedPairs)
    calibrations[id] = {
      method,
      bins,
      platt,
      brierRaw,
      brierCalibrated: brierCal,
      accuracy: acc,
      samples: pairs.length,
    }
  }

  // ---- Build aggregate predictions + per-model CV-tuning inputs ----
  // Use dataset-scaled aggregate weights (same logic as recommend.ts).
  const aggregateWeights = getAdaptiveAggregateWeights(allMatches.length)

  function applyCal(id: string, raw: number): number {
    const c = calibrations[id]!
    if (c.method === 'isotonic' && c.bins) return isotonicApply(c.bins, raw)
    if (c.method === 'platt' && c.platt) return plattApply(c.platt.a, c.platt.b, raw)
    return raw
  }

  // Per-match aggregate snapshot: weighted mean probability, credibility-
  // weighted variance, weighted mean self-confidence. Mirrors recommend.ts'
  // getAggregatePrediction so the tuned thresholds map directly to the
  // runtime badge logic.
  const aggregatePairs = aggregateData.map((d) => {
    const calProbs: Record<string, number> = {}
    for (const id of MODEL_IDS) calProbs[id] = applyCal(id, d.modelProbs[id]!)

    // Credibility weight = aggregateWeight × selfConfidence.
    let totalCred = 0
    const cred: Record<string, number> = {}
    for (const id of MODEL_IDS) {
      const c = (aggregateWeights[id] ?? 0.25) * d.modelSelfConf[id]!
      cred[id] = c
      totalCred += c
    }
    // Fallback if all selfConf are 0 (brand-new heroes) — avoid div-by-zero.
    let totalW: number
    const weights: Record<string, number> = {}
    if (totalCred > 0) {
      totalW = totalCred
      Object.assign(weights, cred)
    } else {
      totalW = 0
      for (const id of MODEL_IDS) {
        const w = aggregateWeights[id] ?? 0.25
        weights[id] = w
        totalW += w
      }
    }

    let prob = 0
    for (const id of MODEL_IDS) prob += (weights[id]! / totalW) * calProbs[id]!

    let variance = 0
    for (const id of MODEL_IDS) variance += (weights[id]! / totalW) * (calProbs[id]! - prob) ** 2
    const weightedStddev = Math.sqrt(variance)

    let avgSelfConf = 0
    for (const id of MODEL_IDS) avgSelfConf += (weights[id]! / totalW) * d.modelSelfConf[id]!

    const predicted = prob >= 0.5 ? 1 : 0
    return {
      prob,
      weightedStddev,
      avgSelfConf,
      actual: d.actual,
      predicted,
    }
  })

  // Per-model tuning inputs: (selfConf, actual, predicted) for each model.
  const perModelTuned: Record<string, PerModelTuned> = {}
  for (const id of MODEL_IDS) {
    const pairs = aggregateData.map((d) => ({
      selfConf: d.modelSelfConf[id]!,
      actual: d.actual,
      // For per-model tuning, predicted outcome is that model's own raw prob
      // (calibrated — so tuning aligns with runtime behavior).
      predicted: applyCal(id, d.modelProbs[id]!) >= 0.5 ? 1 : 0,
    }))
    const decisivePairs = pairs.filter((p) => p.actual !== 0.5)
    const correct = decisivePairs.filter((p) => p.predicted === p.actual).length
    const overallAcc = decisivePairs.length > 0 ? correct / decisivePairs.length : 0
    perModelTuned[id] = tunePerModel(pairs, overallAcc)
  }

  const aggAcc = accuracy(aggregatePairs.map((p) => ({ x: p.prob, y: p.actual })))
  const aggregateTuned = tuneAggregate(aggregatePairs, aggAcc)
  const aggBrier = brierScore(aggregatePairs.map((p) => ({ x: p.prob, y: p.actual })))

  // ---- Print benchmark table ----

  console.log(`\n----- Benchmark (5-fold CV, ${decisive.length} decisive matches) -----\n`)
  console.log('Model           Accuracy   Brier (raw)   Brier (calib)   Method     Samples')
  console.log('-------------   --------   -----------   -------------   --------   -------')
  for (const [id, c] of Object.entries(calibrations)) {
    const name = id.padEnd(13)
    const acc = (c.accuracy * 100).toFixed(1) + '%'
    const bRaw = c.brierRaw.toFixed(4)
    const bCal = c.brierCalibrated.toFixed(4)
    const delta = c.brierCalibrated < c.brierRaw ? '↓' : c.brierCalibrated > c.brierRaw ? '↑' : '='
    console.log(
      `${name}   ${acc.padStart(8)}   ${bRaw.padStart(11)}   ${bCal.padStart(13)} ${delta}  ${c.method.padEnd(8)}   ${String(c.samples).padStart(7)}`,
    )
  }
  console.log(
    `\nAggregate: accuracy=${(aggAcc * 100).toFixed(1)}%, brier=${aggBrier.toFixed(4)} (post-calibration, blended weights)`,
  )

  // ---- Print reliability diagrams ----

  console.log(`\n----- Reliability diagram: Adaptive ML (raw) -----`)
  console.log(reliabilityDiagram(rawPairs['adaptive-ml']!))
  const adaptiveCal = calibrations['adaptive-ml']!
  if (adaptiveCal.method !== 'identity') {
    const calPairs = rawPairs['adaptive-ml']!.map((p) => ({
      x: applyCal('adaptive-ml', p.x),
      y: p.y,
    }))
    console.log(`\n----- Reliability diagram: Adaptive ML (calibrated) -----`)
    console.log(reliabilityDiagram(calPairs))
  }

  console.log(`\n----- Reliability diagram: Aggregate (post-calibration) -----`)
  console.log(reliabilityDiagram(aggregatePairs.map((p) => ({ x: p.prob, y: p.actual }))))

  // ---- Print confidence threshold tuning ----

  console.log(`\n----- Per-model confidence thresholds (selfConf cutoffs) -----`)
  for (const id of MODEL_IDS) {
    const t = perModelTuned[id]!
    console.log(`\n  ${id}:`)
    // Relabel mode: HIGH enabled, MEDIUM cutoff collapsed to 0, no LOW.
    // Signal identifies a reliable top subset rather than an unreliable tail.
    const isRelabeled = t.high <= 1 && t.medium === 0 && t.mediumCoverage > 0
    if (t.high > 1) {
      console.log(`    HIGH:    disabled  (no bucket cleared overall + 2pp)`)
    } else {
      console.log(
        `    HIGH:    selfConf ≥ ${t.high.toFixed(2)}   ${(t.highAcc * 100).toFixed(1)}% acc / ${(t.highCoverage * 100).toFixed(1)}% coverage`,
      )
    }
    if (t.mediumCoverage === 0) {
      console.log(`    MEDIUM:  disabled  (no bucket met target)`)
    } else if (isRelabeled) {
      console.log(
        `    MEDIUM:  selfConf < ${t.high.toFixed(2)}   ${(t.mediumAcc * 100).toFixed(1)}% acc / ${(t.mediumCoverage * 100).toFixed(1)}% coverage   [relabeled — signal flags a reliable top subset, not an unreliable tail]`,
      )
    } else {
      console.log(
        `    MEDIUM:  selfConf ≥ ${t.medium.toFixed(2)}   ${(t.mediumAcc * 100).toFixed(1)}% acc / ${(t.mediumCoverage * 100).toFixed(1)}% coverage`,
      )
    }
    // LOW only meaningful when MEDIUM cutoff > 0 AND below-bucket is measurable
    if (t.medium > 0 && t.lowCoverage > 0) {
      const drop = t.mediumAcc - t.lowAcc
      const justified = drop >= PER_MODEL_LOW_DROP_BELOW_MEDIUM
      const flag = justified ? 'justified' : 'not justified (drop < 1pp)'
      console.log(
        `    LOW:     selfConf < ${t.medium.toFixed(2)}   ${(t.lowAcc * 100).toFixed(1)}% acc / ${(t.lowCoverage * 100).toFixed(1)}% coverage   [drop ${(drop * 100).toFixed(1)}pp — ${flag}]`,
      )
    } else if (isRelabeled) {
      console.log(`    LOW:     (disabled — relabeled framing; MEDIUM is the typical tier)`)
    } else {
      console.log(`    LOW:     (empty — MEDIUM includes all predictions)`)
    }
  }

  console.log(`\n----- Aggregate confidence thresholds -----`)
  const a = aggregateTuned
  // Relabel mode: HIGH identifies a reliable top subset, MEDIUM is the complement, no LOW.
  const aggIsRelabeled = a.highCoverage > 0 && a.mediumStddev === 1 && a.mediumAvgSelfConf === 0
  if (a.highCoverage === 0) {
    console.log(`    HIGH:    disabled  (no bucket cleared overall + 2pp)`)
  } else {
    console.log(
      `    HIGH:    weighted_stddev ≤ ${a.highStddev.toFixed(2)}  AND  avg_self_conf ≥ ${a.highAvgSelfConf.toFixed(2)}   ${(a.highAcc * 100).toFixed(1)}% acc / ${(a.highCoverage * 100).toFixed(1)}% coverage`,
    )
  }
  if (a.mediumCoverage === 0) {
    console.log(`    MEDIUM:  disabled`)
  } else if (aggIsRelabeled) {
    console.log(
      `    MEDIUM:  (complement of HIGH)             ${(a.mediumAcc * 100).toFixed(1)}% acc / ${(a.mediumCoverage * 100).toFixed(1)}% coverage   [relabeled — signal flags reliable top subset]`,
    )
  } else {
    console.log(
      `    MEDIUM:  weighted_stddev ≤ ${a.mediumStddev.toFixed(2)}  AND  avg_self_conf ≥ ${a.mediumAvgSelfConf.toFixed(2)}   ${(a.mediumAcc * 100).toFixed(1)}% acc / ${(a.mediumCoverage * 100).toFixed(1)}% coverage`,
    )
  }
  if (a.mediumCoverage > 0 && a.lowCoverage > 0) {
    const drop = a.mediumAcc - a.lowAcc
    const justified = drop >= AGGREGATE_LOW_DROP_BELOW_MEDIUM
    const flag = justified ? 'justified' : 'not justified (drop < 1pp)'
    console.log(
      `    LOW:     (complement of MEDIUM)             ${(a.lowAcc * 100).toFixed(1)}% acc / ${(a.lowCoverage * 100).toFixed(1)}% coverage   [drop ${(drop * 100).toFixed(1)}pp — ${flag}]`,
    )
  } else if (aggIsRelabeled) {
    console.log(`    LOW:     (disabled — relabeled framing; MEDIUM is the typical tier)`)
  } else {
    console.log(`    LOW:     (empty — MEDIUM covers everything)`)
  }

  // ---- Write calibrationData.ts ----

  const round = (x: number) => Math.round(x * 1e6) / 1e6
  const calObj: Record<string, unknown> = {}
  for (const [id, c] of Object.entries(calibrations)) {
    const obj: Record<string, unknown> = {
      method: c.method,
      brierRaw: round(c.brierRaw),
      brierCalibrated: round(c.brierCalibrated),
      accuracy: round(c.accuracy),
      samples: c.samples,
    }
    if (c.bins) {
      obj.bins = c.bins.map((b) => ({
        rawProb: round(b.rawProb),
        calibratedProb: round(b.calibratedProb),
      }))
    }
    if (c.platt) {
      obj.platt = { a: round(c.platt.a), b: round(c.platt.b) }
    }
    calObj[id] = obj
  }

  const perModelThresholdsObj: Record<string, { high: number; medium: number }> = {}
  for (const id of MODEL_IDS) {
    const t = perModelTuned[id]!
    perModelThresholdsObj[id] = { high: round(t.high), medium: round(t.medium) }
  }
  const thresholdsObj = {
    perModel: perModelThresholdsObj,
    aggregate: {
      highStddev: round(aggregateTuned.highStddev),
      highAvgSelfConf: round(aggregateTuned.highAvgSelfConf),
      mediumStddev: round(aggregateTuned.mediumStddev),
      mediumAvgSelfConf: round(aggregateTuned.mediumAvgSelfConf),
    },
  }

  const outPath = join(import.meta.dirname!, '..', 'prediction', 'calibrationData.ts')
  const content = `// Auto-generated by benchmark.ts — do not edit manually.
// Regenerated by \`npm run ww:train\` (which runs benchmark after NN training).

export type CalibrationMethod = 'identity' | 'isotonic' | 'platt'

export interface Calibration {
  method: CalibrationMethod
  /** Isotonic lookup table (sorted by rawProb ascending). */
  bins?: { rawProb: number; calibratedProb: number }[]
  /** Platt scaling coefficients: calibrated = 1 / (1 + exp(a * raw + b)). */
  platt?: { a: number; b: number }
  /** Cross-validated Brier score (for diagnostics). */
  brierRaw?: number
  brierCalibrated?: number
  /** CV accuracy at the 0.5 decision threshold. */
  accuracy?: number
  /** Sample size used to fit. */
  samples?: number
}

/**
 * Per-model self-confidence thresholds. Each model publishes a signal in
 * [0, 1] (see \`modelConfidence.ts\`); these cutoffs are tuned per-model
 * against held-out accuracy.
 */
export interface PerModelThresholds {
  high: number
  medium: number
}

/**
 * Aggregate thresholds combine two signals:
 *   - weightedStddev: credibility-weighted variance across the 4 model
 *     probabilities (low stddev = models agree, weighted by per-model
 *     self-confidence so sparse-data outliers count less)
 *   - avgSelfConf: weighted mean of per-model self-confidences
 * High = both pass high cutoffs. Medium = both pass medium cutoffs. Low = else.
 */
export interface AggregateThresholds {
  highStddev: number
  highAvgSelfConf: number
  mediumStddev: number
  mediumAvgSelfConf: number
}

export interface ConfidenceThresholds {
  perModel: Record<string, PerModelThresholds>
  aggregate: AggregateThresholds
}

export const CONFIDENCE_THRESHOLDS: ConfidenceThresholds = ${JSON.stringify(thresholdsObj, null, 2)}

export const CALIBRATION: Record<string, Calibration> = ${JSON.stringify(calObj, null, 2)}
`
  writeFileSync(outPath, content)
  console.log(`\nCalibration written to ${outPath}`)
}
