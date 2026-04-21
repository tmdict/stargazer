import { getAdaptiveAggregateWeights } from '../constants'
import encodedData from '../data/data?raw'
import { getUniqueHeroes, parseMatchData } from '../records/parser'
import type {
  AnalysisData,
  MatchNote,
  MatchResult,
  MatchupPrediction,
  Recommendation,
  RecommendationModel,
} from '../types'
import { adaptiveMLModel } from './adaptiveML'
import { analyzeMatches } from './analysis'
import { bradleyTerryModel, getCachedBradleyTerryFit } from './bradleyTerry'
import { calibrate } from './calibration'
import { CONFIDENCE_THRESHOLDS } from './calibrationData'
import { compositeModel } from './composite'
import { computeAllSelfConfidences } from './modelConfidence'
import { popularPickModel } from './popularPick'

const rawData = atob(encodedData)

const models: RecommendationModel[] = [
  popularPickModel,
  compositeModel,
  bradleyTerryModel,
  adaptiveMLModel,
]

let cachedMatches: MatchResult[] | null = null
let cachedAnalysis: AnalysisData | null = null

function getMatches(): MatchResult[] {
  if (!cachedMatches) {
    cachedMatches = parseMatchData(rawData)
  }
  return cachedMatches
}

function getAnalysis(): AnalysisData {
  if (!cachedAnalysis) {
    const matches = getMatches()
    const heroes = getUniqueHeroes(matches)
    cachedAnalysis = analyzeMatches(matches, heroes)
  }
  return cachedAnalysis
}

export function getMatchData(): MatchResult[] {
  return getMatches()
}

export function getAnalysisData(): AnalysisData {
  return getAnalysis()
}

export function getModels(): RecommendationModel[] {
  return models
}

export function getRecommendations(
  modelId: string,
  teammates: string[],
  opponents: string[],
  pickedHeroes: string[],
): Recommendation[] {
  const model = models.find((m) => m.id === modelId)
  if (!model) return []

  const analysis = getAnalysis()
  const matches = getMatches()
  const available = analysis.allHeroes.filter((h) => !pickedHeroes.includes(h))

  return model.recommend(teammates, opponents, available, analysis, matches)
}

/**
 * Wrap a raw MatchupPrediction's probabilities through the per-model
 * calibration map. The model's confidence badge is replaced by a reliability
 * badge derived from this model's own self-confidence signal (how well-
 * supported is this model's answer for THIS specific matchup).
 */
function calibratedPrediction(
  modelId: string,
  raw: MatchupPrediction,
  selfConfidence: number,
): MatchupPrediction {
  const calLeft = calibrate(modelId, raw.leftWinProbability)
  return {
    ...raw,
    leftWinProbability: calLeft,
    rightWinProbability: 1 - calLeft,
    confidence: perModelConfidence(modelId, selfConfidence),
  }
}

export function getMatchupPrediction(
  modelId: string,
  leftTeam: string[],
  rightTeam: string[],
): MatchupPrediction | null {
  const model = models.find((m) => m.id === modelId)
  if (!model) return null
  const analysis = getAnalysis()
  const matches = getMatches()
  const btFit = getCachedBradleyTerryFit(matches, analysis)
  const selfConf = computeAllSelfConfidences(leftTeam, rightTeam, analysis, matches, btFit)
  const raw = model.predictMatchup(leftTeam, rightTeam, analysis, matches)
  return calibratedPrediction(modelId, raw, selfConf[modelId] ?? 0)
}

export interface ModelPrediction {
  id: string
  name: string
  prediction: MatchupPrediction
  /** Raw pre-calibration probability (kept for diagnostics). */
  rawLeftWinProbability: number
  /** Per-model self-confidence [0, 1] — how well the data supports this model's answer. */
  selfConfidence: number
}

export function getAllMatchupPredictions(
  leftTeam: string[],
  rightTeam: string[],
): ModelPrediction[] {
  const analysis = getAnalysis()
  const matches = getMatches()
  const btFit = getCachedBradleyTerryFit(matches, analysis)
  const selfConf = computeAllSelfConfidences(leftTeam, rightTeam, analysis, matches, btFit)
  return models.map((model) => {
    const raw = model.predictMatchup(leftTeam, rightTeam, analysis, matches)
    const sc = selfConf[model.id] ?? 0
    return {
      id: model.id,
      name: model.name,
      prediction: calibratedPrediction(model.id, raw, sc),
      rawLeftWinProbability: raw.leftWinProbability,
      selfConfidence: sc,
    }
  })
}

export interface AggregatePrediction {
  leftWinProbability: number
  rightWinProbability: number
  confidence: 'high' | 'medium' | 'low'
  /**
   * Credibility-weighted stddev across model probabilities. Each model's
   * contribution to disagreement is weighted by its aggregate share × its
   * own self-confidence — so a sparse-data outlier counts less.
   */
  weightedStddev: number
  /** Weighted mean of per-model self-confidences. */
  avgSelfConfidence: number
  relevantNotes: MatchNote[]
  matchCount: number
  heroCount: number
}

/**
 * Per-model confidence badge — reflects how well this model's data supports
 * its answer for THIS specific matchup (see `modelConfidence.ts`). Each
 * model has its own thresholds because each measures a different signal.
 */
function perModelConfidence(modelId: string, selfConfidence: number): 'high' | 'medium' | 'low' {
  const t = CONFIDENCE_THRESHOLDS.perModel[modelId]
  if (!t) return 'low'
  if (selfConfidence >= t.high) return 'high'
  if (selfConfidence >= t.medium) return 'medium'
  return 'low'
}

/**
 * Aggregate confidence — two signals:
 *   1. Credibility-weighted variance of model probabilities. Models that
 *      have low self-confidence or low aggregate weight contribute less to
 *      the "disagreement" metric, so a sparse-data outlier doesn't torpedo
 *      a prediction 3 high-confidence models are aligned on.
 *   2. Weighted mean of per-model self-confidences. Captures how much
 *      underlying data backs the matchup overall.
 *
 * High = both pass high cutoffs. Medium = both pass medium cutoffs. Low = either fails.
 * Thresholds fit against held-out CV in `calibrationData.ts`.
 */
function aggregateConfidence(
  weightedStddev: number,
  avgSelfConfidence: number,
): 'high' | 'medium' | 'low' {
  const t = CONFIDENCE_THRESHOLDS.aggregate
  if (weightedStddev <= t.highStddev && avgSelfConfidence >= t.highAvgSelfConf) return 'high'
  if (weightedStddev <= t.mediumStddev && avgSelfConfidence >= t.mediumAvgSelfConf) return 'medium'
  return 'low'
}

export function getAggregatePrediction(predictions: ModelPrediction[]): AggregatePrediction {
  const matches = getMatches()
  const analysis = getAnalysis()
  const matchCount = matches.length
  const heroCount = analysis.allHeroes.length

  const baseWeights = getAdaptiveAggregateWeights(matchCount)

  // Credibility weight = aggregate weight × self-confidence. Low-confidence
  // models have their vote downweighted in both the probability blend and
  // the disagreement metric.
  let totalCredibility = 0
  const credibility: Record<string, number> = {}
  for (const pred of predictions) {
    const aggWeight = baseWeights[pred.id] ?? 0.25
    const cred = aggWeight * pred.selfConfidence
    credibility[pred.id] = cred
    totalCredibility += cred
  }

  // Fall back to plain aggregate weights if all self-confidences are 0
  // (e.g., every hero has 0 matches in the analysis — unusual but possible
  // for brand-new heroes). Prevents a division-by-zero collapse.
  let totalWeight: number
  const weights: Record<string, number> = {}
  if (totalCredibility > 0) {
    totalWeight = totalCredibility
    Object.assign(weights, credibility)
  } else {
    totalWeight = 0
    for (const pred of predictions) {
      const w = baseWeights[pred.id] ?? 0.25
      weights[pred.id] = w
      totalWeight += w
    }
  }

  // Weighted mean prediction
  let leftWinProbability = 0
  for (const pred of predictions) {
    const p = pred.prediction.leftWinProbability
    leftWinProbability += (weights[pred.id]! / totalWeight) * p
  }

  // Weighted variance (around the weighted mean)
  let variance = 0
  for (const pred of predictions) {
    const p = pred.prediction.leftWinProbability
    variance += (weights[pred.id]! / totalWeight) * (p - leftWinProbability) ** 2
  }
  const weightedStddev = Math.sqrt(variance)

  // Weighted mean self-confidence
  let avgSelfConfidence = 0
  for (const pred of predictions) {
    avgSelfConfidence += (weights[pred.id]! / totalWeight) * pred.selfConfidence
  }

  const confidence = aggregateConfidence(weightedStddev, avgSelfConfidence)

  const seenNotes = new Set<string>()
  const relevantNotes: MatchNote[] = []
  for (const pred of predictions) {
    for (const note of pred.prediction.relevantNotes) {
      if (!seenNotes.has(note.text)) {
        seenNotes.add(note.text)
        relevantNotes.push(note)
      }
    }
  }

  return {
    leftWinProbability,
    rightWinProbability: 1 - leftWinProbability,
    confidence,
    weightedStddev,
    avgSelfConfidence,
    relevantNotes,
    matchCount,
    heroCount,
  }
}
