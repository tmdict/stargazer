import { buildSynergy } from './synergy'
import { buildTeams } from './teams'
import type { Insight, InsightCategory, InsightDeps } from './types'
import { buildUnits } from './units'

export type { Insight, InsightCategory, InsightDeps, SweepRecord } from './types'

// Builds insights for a single category. Caller passes pre-computed Vue refs unwrapped.
// Switching tabs only re-runs the relevant builder, so the heaviest sections (NN trios,
// composition aggregation) only fire when their tab is active.
export function buildInsights(category: InsightCategory, deps: InsightDeps): Insight[] {
  switch (category) {
    case 'units':
      return buildUnits(deps)
    case 'teams':
      return buildTeams(deps)
    case 'synergy':
      return buildSynergy(deps)
  }
}
