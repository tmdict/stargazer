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

import { analyzeMatches } from '../prediction/analysis'
import { fitBradleyTerry } from '../prediction/bradleyTerry'
import { isotonicApply, plattApply } from '../prediction/calibration'
import { compositeModel } from '../prediction/composite'
import { popularPickModel } from '../prediction/popularPick'
import type { MatchResult, RecommendationModel } from '../types'
import { buildSamples, forwardPredict, trainRun, type TrainingSample } from './trainNNCore'

const NUM_FOLDS = 5
const FOLD_SEED = 42
const NN_FOLD_SEED_BASE = 1000
const MIN_ISOTONIC_SAMPLES = 300
const MIN_CALIBRATION_SAMPLES = 100
const TARGET_BINS = 12
const HIGH_TARGET_ACC = 0.75 // "high confidence" predictions should hit >= this in CV
const MEDIUM_TARGET_ACC = 0.65

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

interface ConfidenceTuning {
  highDistance: number
  mediumDistance: number
  highAgreementStddev: number
  mediumAgreementStddev: number
  highAccuracy: number
  mediumAccuracy: number
  highCoverage: number
  mediumCoverage: number
}

/**
 * Tune distance/agreement thresholds so "high" predictions hit >= HIGH_TARGET_ACC
 * on held-out data, using aggregate model predictions as the calibration set.
 */
function tuneConfidenceThresholds(
  aggregatePairs: { prob: number; stddev: number; actual: number }[],
): ConfidenceTuning {
  // Grid search distance thresholds, pick smallest that hits target accuracy
  const distanceGrid = [0.05, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.25]
  const stddevGrid = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2]

  function matches(p: { prob: number; stddev: number }, distTh: number, stdTh: number): boolean {
    return Math.abs(p.prob - 0.5) >= distTh && p.stddev <= stdTh
  }

  function bucketAcc(distTh: number, stdTh: number): { acc: number; coverage: number; n: number } {
    const subset = aggregatePairs.filter((p) => p.actual !== 0.5 && matches(p, distTh, stdTh))
    if (subset.length === 0) return { acc: 0, coverage: 0, n: 0 }
    let correct = 0
    for (const p of subset) {
      const pred = p.prob >= 0.5 ? 1 : 0
      if (pred === p.actual) correct++
    }
    return {
      acc: correct / subset.length,
      coverage: subset.length / aggregatePairs.length,
      n: subset.length,
    }
  }

  // Pick the permissive-est thresholds that still clear HIGH_TARGET_ACC.
  // Prefer higher coverage (more greens) among those that pass.
  let best: {
    dist: number
    std: number
    acc: number
    coverage: number
  } = { dist: 0.2, std: 0.08, acc: 0, coverage: 0 }
  for (const d of distanceGrid) {
    for (const s of stddevGrid) {
      const r = bucketAcc(d, s)
      if (r.n < 20) continue // not enough data to trust
      if (r.acc >= HIGH_TARGET_ACC && r.coverage > best.coverage) {
        best = { dist: d, std: s, acc: r.acc, coverage: r.coverage }
      }
    }
  }

  // Tune medium thresholds similarly
  let bestMedium: {
    dist: number
    std: number
    acc: number
    coverage: number
  } = { dist: 0.05, std: 0.15, acc: 0, coverage: 0 }
  for (const d of distanceGrid) {
    for (const s of stddevGrid) {
      if (d >= best.dist && s <= best.std) continue // already "high"
      const r = bucketAcc(d, s)
      if (r.n < 20) continue
      if (r.acc >= MEDIUM_TARGET_ACC && r.coverage > bestMedium.coverage) {
        bestMedium = { dist: d, std: s, acc: r.acc, coverage: r.coverage }
      }
    }
  }

  return {
    highDistance: best.dist,
    mediumDistance: bestMedium.dist,
    highAgreementStddev: best.std,
    mediumAgreementStddev: bestMedium.std,
    highAccuracy: best.acc,
    mediumAccuracy: bestMedium.acc,
    highCoverage: best.coverage,
    mediumCoverage: bestMedium.coverage,
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

  // For aggregate agreement-based confidence tuning, save all 4 predictions per match
  const aggregateData: { modelProbs: Record<string, number>; actual: number }[] = []

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

      aggregateData.push({ modelProbs, actual })
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

  // ---- Build aggregate calibrated predictions for confidence threshold tuning ----
  // Use mid-dataset fixed weights for the aggregate (matches recommend.ts at ~100 matches).
  const AGGREGATE_WEIGHTS: Record<string, number> = {
    'popular-pick': 0.35,
    composite: 0.25,
    'bradley-terry': 0.2,
    'adaptive-ml': 0.2,
  }

  function applyCal(id: string, raw: number): number {
    const c = calibrations[id]!
    if (c.method === 'isotonic' && c.bins) return isotonicApply(c.bins, raw)
    if (c.method === 'platt' && c.platt) return plattApply(c.platt.a, c.platt.b, raw)
    return raw
  }

  const aggregatePairs = aggregateData.map((d) => {
    const calibratedProbs: number[] = []
    let weighted = 0
    let totalW = 0
    for (const [id, w] of Object.entries(AGGREGATE_WEIGHTS)) {
      const cal = applyCal(id, d.modelProbs[id]!)
      calibratedProbs.push(cal)
      weighted += w * cal
      totalW += w
    }
    const prob = weighted / totalW
    const mean = calibratedProbs.reduce((s, p) => s + p, 0) / calibratedProbs.length
    const variance =
      calibratedProbs.reduce((s, p) => s + (p - mean) * (p - mean), 0) / calibratedProbs.length
    const stddev = Math.sqrt(variance)
    return { prob, stddev, actual: d.actual }
  })

  const tuning = tuneConfidenceThresholds(aggregatePairs)
  const aggAcc = accuracy(aggregatePairs.map((p) => ({ x: p.prob, y: p.actual })))
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

  console.log(`\n----- Confidence thresholds (tuned against CV aggregate) -----`)
  console.log(
    `High:   |p-0.5| >= ${tuning.highDistance.toFixed(2)}  AND  stddev <= ${tuning.highAgreementStddev.toFixed(2)}  →  ${(tuning.highAccuracy * 100).toFixed(1)}% acc, ${(tuning.highCoverage * 100).toFixed(1)}% coverage`,
  )
  console.log(
    `Medium: |p-0.5| >= ${tuning.mediumDistance.toFixed(2)}  AND  stddev <= ${tuning.mediumAgreementStddev.toFixed(2)}  →  ${(tuning.mediumAccuracy * 100).toFixed(1)}% acc, ${(tuning.mediumCoverage * 100).toFixed(1)}% coverage`,
  )

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

  const thresholdsObj = {
    highDistance: round(tuning.highDistance),
    mediumDistance: round(tuning.mediumDistance),
    highAgreementStddev: round(tuning.highAgreementStddev),
    mediumAgreementStddev: round(tuning.mediumAgreementStddev),
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

export interface ConfidenceThresholds {
  highDistance: number
  mediumDistance: number
  highAgreementStddev: number
  mediumAgreementStddev: number
}

export const CONFIDENCE_THRESHOLDS: ConfidenceThresholds = ${JSON.stringify(thresholdsObj, null, 2)}

export const CALIBRATION: Record<string, Calibration> = ${JSON.stringify(calObj, null, 2)}
`
  writeFileSync(outPath, content)
  console.log(`\nCalibration written to ${outPath}`)
}
