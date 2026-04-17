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
import { analyzeMatches } from './analysis'
import { bradleyTerryModel } from './bradleyTerry'
import { compositeModel } from './composite'
import { popularPickModel } from './popularPick'

const rawData = atob(encodedData)

const models: RecommendationModel[] = [popularPickModel, bradleyTerryModel, compositeModel]

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

export function getMatchupPrediction(
  modelId: string,
  leftTeam: string[],
  rightTeam: string[],
): MatchupPrediction | null {
  const model = models.find((m) => m.id === modelId)
  if (!model) return null

  return model.predictMatchup(leftTeam, rightTeam, getAnalysis(), getMatches())
}

export interface ModelPrediction {
  id: string
  name: string
  prediction: MatchupPrediction
}

export function getAllMatchupPredictions(
  leftTeam: string[],
  rightTeam: string[],
): ModelPrediction[] {
  const analysis = getAnalysis()
  const matches = getMatches()
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    prediction: model.predictMatchup(leftTeam, rightTeam, analysis, matches),
  }))
}

export interface AggregatePrediction {
  leftWinProbability: number
  rightWinProbability: number
  confidence: 'high' | 'medium' | 'low'
  relevantNotes: MatchNote[]
  matchCount: number
  heroCount: number
}

const CONFIDENCE_MULTIPLIERS: Record<string, number> = {
  high: 1.0,
  medium: 0.5,
  low: 0.2,
}

const CONFIDENCE_ORDER: ('high' | 'medium' | 'low')[] = ['low', 'medium', 'high']

function getAdaptiveWeights(matchCount: number): Record<string, number> {
  if (matchCount < 20) {
    return { 'popular-pick': 0.6, 'bradley-terry': 0.1, composite: 0.3 }
  }
  if (matchCount <= 100) {
    const t = (matchCount - 20) / 80
    return {
      'popular-pick': 0.6 - 0.27 * t,
      'bradley-terry': 0.1 + 0.23 * t,
      composite: 0.3 + 0.03 * t,
    }
  }
  const t = Math.min(1, (matchCount - 100) / 400)
  return {
    'popular-pick': 0.33 - 0.13 * t,
    'bradley-terry': 0.33 + 0.07 * t,
    composite: 0.33 + 0.07 * t,
  }
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
    const w =
      (baseWeights[pred.id] ?? 0.33) * (CONFIDENCE_MULTIPLIERS[pred.prediction.confidence] ?? 0.2)
    weights[pred.id] = w
    totalWeight += w
  }

  let leftWinProbability = 0
  for (const pred of predictions) {
    leftWinProbability += (weights[pred.id]! / totalWeight) * pred.prediction.leftWinProbability
  }

  const confidence = predictions.reduce(
    (worst, pred) => {
      return CONFIDENCE_ORDER.indexOf(pred.prediction.confidence) < CONFIDENCE_ORDER.indexOf(worst)
        ? pred.prediction.confidence
        : worst
    },
    'high' as 'high' | 'medium' | 'low',
  )

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
    relevantNotes,
    matchCount,
    heroCount,
  }
}
