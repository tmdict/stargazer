import { analyzeMatches } from './analysis'
import { bradleyTerryModel } from './bradleyTerry'
import { compositeModel } from './composite'
import rawData from './data/wandwars.data?raw'
import { metaPickModel } from './metaPick'
import { getUniqueHeroes, parseMatchData } from './parser'
import type {
  AnalysisData,
  MatchResult,
  MatchupPrediction,
  Recommendation,
  RecommendationModel,
} from './types'

const models: RecommendationModel[] = [metaPickModel, compositeModel, bradleyTerryModel]

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

export function getAllMatchupPredictions(
  leftTeam: string[],
  rightTeam: string[],
): { id: string; name: string; prediction: MatchupPrediction }[] {
  const analysis = getAnalysis()
  const matches = getMatches()
  return models.map((model) => ({
    id: model.id,
    name: model.name,
    prediction: model.predictMatchup(leftTeam, rightTeam, analysis, matches),
  }))
}
