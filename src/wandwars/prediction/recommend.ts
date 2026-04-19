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
import { bradleyTerryModel } from './bradleyTerry'
import { calibrate } from './calibration'
import { CONFIDENCE_THRESHOLDS } from './calibrationData'
import { compositeModel } from './composite'
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

/** Wrap a raw MatchupPrediction's probabilities through the per-model calibration map. */
function calibratedPrediction(modelId: string, raw: MatchupPrediction): MatchupPrediction {
  const calLeft = calibrate(modelId, raw.leftWinProbability)
  return {
    ...raw,
    leftWinProbability: calLeft,
    rightWinProbability: 1 - calLeft,
    // Replace the hero-depth Wilson badge with a prediction-level badge:
    // distance of the calibrated probability from 50%.
    confidence: perModelConfidence(calLeft),
  }
}

export function getMatchupPrediction(
  modelId: string,
  leftTeam: string[],
  rightTeam: string[],
): MatchupPrediction | null {
  const model = models.find((m) => m.id === modelId)
  if (!model) return null
  const raw = model.predictMatchup(leftTeam, rightTeam, getAnalysis(), getMatches())
  return calibratedPrediction(modelId, raw)
}

export interface ModelPrediction {
  id: string
  name: string
  prediction: MatchupPrediction
  /** Raw pre-calibration probability (kept for diagnostics). */
  rawLeftWinProbability: number
}

export function getAllMatchupPredictions(
  leftTeam: string[],
  rightTeam: string[],
): ModelPrediction[] {
  const analysis = getAnalysis()
  const matches = getMatches()
  return models.map((model) => {
    const raw = model.predictMatchup(leftTeam, rightTeam, analysis, matches)
    return {
      id: model.id,
      name: model.name,
      prediction: calibratedPrediction(model.id, raw),
      rawLeftWinProbability: raw.leftWinProbability,
    }
  })
}

export interface AggregatePrediction {
  leftWinProbability: number
  rightWinProbability: number
  confidence: 'high' | 'medium' | 'low'
  /** Stddev across per-model calibrated probabilities — proxy for model agreement. */
  modelAgreementStddev: number
  relevantNotes: MatchNote[]
  matchCount: number
  heroCount: number
}

function getAdaptiveWeights(matchCount: number): Record<string, number> {
  // Weights reflect measured CV performance at current dataset size (~1,100
  // matches). Hero Synergy and Team Power lead; Adaptive ML gets ensemble
  // weight but not majority weight. Re-evaluate after every `ww:train` run
  // when the gap between models shifts meaningfully.
  if (matchCount < 20) {
    return { 'popular-pick': 0.55, composite: 0.3, 'bradley-terry': 0.1, 'adaptive-ml': 0.05 }
  }
  if (matchCount <= 100) {
    // 20 → 100: ramp Popular Pick down, Team Power up, Adaptive ML up
    // toward the mid-range balance. Hero Synergy holds at 30%.
    const t = (matchCount - 20) / 80
    return {
      'popular-pick': 0.55 - 0.25 * t,
      composite: 0.3,
      'bradley-terry': 0.1 + 0.15 * t,
      'adaptive-ml': 0.05 + 0.1 * t,
    }
  }
  // 100 → 500+: Hero Synergy and Team Power hold, Popular Pick softens,
  // Adaptive ML earns a modest bump for ensemble diversity.
  const t = Math.min(1, (matchCount - 100) / 400)
  return {
    'popular-pick': 0.3 - 0.05 * t,
    composite: 0.3,
    'bradley-terry': 0.25,
    'adaptive-ml': 0.15 + 0.05 * t,
  }
}

/**
 * Match-prediction confidence: based on distance from 50% (meaningful prediction)
 * and across-model stddev (model agreement). Thresholds fit against held-out
 * benchmark data in `calibrationData.ts`.
 */
function matchPredictionConfidence(
  calibratedProb: number,
  modelProbs: number[],
): { confidence: 'high' | 'medium' | 'low'; stddev: number } {
  const distance = Math.abs(calibratedProb - 0.5)
  const mean = modelProbs.reduce((s, p) => s + p, 0) / modelProbs.length
  const variance = modelProbs.reduce((s, p) => s + (p - mean) * (p - mean), 0) / modelProbs.length
  const stddev = Math.sqrt(variance)

  const t = CONFIDENCE_THRESHOLDS
  if (distance >= t.highDistance && stddev <= t.highAgreementStddev) {
    return { confidence: 'high', stddev }
  }
  if (distance >= t.mediumDistance && stddev <= t.mediumAgreementStddev) {
    return { confidence: 'medium', stddev }
  }
  return { confidence: 'low', stddev }
}

/** Single-model badge: distance-from-50% only (no agreement signal). */
function perModelConfidence(calibratedProb: number): 'high' | 'medium' | 'low' {
  const distance = Math.abs(calibratedProb - 0.5)
  const t = CONFIDENCE_THRESHOLDS
  if (distance >= t.highDistance) return 'high'
  if (distance >= t.mediumDistance) return 'medium'
  return 'low'
}

export function getAggregatePrediction(predictions: ModelPrediction[]): AggregatePrediction {
  const matches = getMatches()
  const analysis = getAnalysis()
  const matchCount = matches.length
  const heroCount = analysis.allHeroes.length

  const baseWeights = getAdaptiveWeights(matchCount)

  let totalWeight = 0
  const weights: Record<string, number> = {}
  for (const pred of predictions) {
    const w = baseWeights[pred.id] ?? 0.25
    weights[pred.id] = w
    totalWeight += w
  }

  const modelProbs: number[] = []
  let leftWinProbability = 0
  for (const pred of predictions) {
    const p = pred.prediction.leftWinProbability
    modelProbs.push(p)
    leftWinProbability += (weights[pred.id]! / totalWeight) * p
  }

  const { confidence, stddev } = matchPredictionConfidence(leftWinProbability, modelProbs)

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
    modelAgreementStddev: stddev,
    relevantNotes,
    matchCount,
    heroCount,
  }
}
