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
  // Patch identifier (e.g. `202604_1.6.3`) attached by `parseMatchData` from
  // the most-recent `// @patch <id>` directive in the source. The encoded blob
  // always carries directives; matches without one are skipped with a warning.
  // Reserved for future patch-aware analysis (see WAND_WARS.md §10).
  patch: string
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

export interface TrioEntry {
  matches: number
  wins: number
  losses: number
  winRate: number // Bayesian-smoothed
  score: number // residual: trioWinRate - average pairwise prediction
}

export interface TrioMatrix {
  /** Key: sorted trio joined with ',' */
  [trioKey: string]: TrioEntry
}

export interface AnalysisData {
  heroStats: Record<string, HeroStats>
  synergyMatrix: SynergyMatrix
  counterMatrix: CounterMatrix
  trioMatrix: TrioMatrix
  allHeroes: string[]
  totalMatches: number
}

export interface Recommendation {
  hero: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: Record<
    string,
    number | { teammate: string; wins: number; losses: number; total: number }[]
  >
  relevantNotes: MatchNote[]
}

// What models produce: probabilities and notes only. The reliability badge is
// owned by the calibration layer (recommend.ts calibratedPrediction), not the
// models themselves.
export interface MatchupPrediction {
  leftWinProbability: number
  rightWinProbability: number
  relevantNotes: MatchNote[]
}

export interface CalibratedMatchupPrediction extends MatchupPrediction {
  confidence: 'high' | 'medium' | 'low'
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

export type PickSide = 'left' | 'right'
export interface PickState {
  left: (string | null)[]
  right: (string | null)[]
}
