export interface MatchNote {
  text: string
  heroes: string[]
}

export interface MatchResult {
  left: [string, string, string]
  right: [string, string, string]
  result: 'left' | 'right' | 'draw'
  weight: number
  notes: MatchNote[]
}

export interface HeroStats {
  name: string
  matches: number
  wins: number
  losses: number
  draws: number
  weightedWins: number
  weightedLosses: number
  winRate: number
}

export interface SynergyMatrix {
  [heroA: string]: { [heroB: string]: SynergyEntry }
}

export interface SynergyEntry {
  matches: number
  wins: number
  losses: number
  score: number
}

export interface CounterMatrix {
  [hero: string]: { [opponent: string]: CounterEntry }
}

export interface CounterEntry {
  matches: number
  wins: number
  losses: number
  score: number
}

export interface AnalysisData {
  heroStats: Record<string, HeroStats>
  synergyMatrix: SynergyMatrix
  counterMatrix: CounterMatrix
  allHeroes: string[]
  totalMatches: number
}

export interface Recommendation {
  hero: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<string, number | { teammate: string; wins: number; total: number }[]>
  relevantNotes: MatchNote[]
}

export interface MatchupPrediction {
  leftWinProbability: number
  rightWinProbability: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<string, number>
  relevantNotes: MatchNote[]
}

export interface RecommendationModel {
  id: string
  name: string
  recommend(
    teammates: string[],
    opponents: string[],
    available: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): Recommendation[]
  predictMatchup(
    leftTeam: string[],
    rightTeam: string[],
    analysisData: AnalysisData,
    matches: MatchResult[],
  ): MatchupPrediction
}

export interface RecordedMatch {
  left: [string, string, string]
  right: [string, string, string]
  winner: 'left' | 'right' | 'draw'
  dominant: boolean
  notes: string
}

export interface TeamRecord {
  team: [string, string, string]
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number
}

export type PickSide = 'left' | 'right'
export interface PickState {
  left: (string | null)[]
  right: (string | null)[]
}
