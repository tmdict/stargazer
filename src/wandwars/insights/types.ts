import type { CharacterType } from '@/lib/types/character'
import type { AnalysisData, MatchResult, TeamRecord } from '@/wandwars/types'

export type InsightCategory = 'units' | 'teams' | 'synergy'

export interface Insight {
  text: string
  category: InsightCategory
}

export interface SweepRecord {
  team: string[]
  sweeps: number
  total: number
}

// Inputs each builder needs. The .vue file already has these as Vue computeds; it passes
// the unwrapped values into the builder. Builders are pure — no Vue, no Pinia, no i18n
// store imports — so they can be unit-tested with plain fixtures.
export interface InsightDeps {
  matchData: MatchResult[]
  analysisData: AnalysisData
  teamRecords: TeamRecord[]
  topSweepTeam: SweepRecord | undefined
  topSweepPair: SweepRecord | undefined
  heroAttrMap: Record<string, CharacterType>
  // i18n.t — already supports optional vars via the recent `interpolate` change.
  t: (key: string, vars?: Record<string, string | number>) => string
}
