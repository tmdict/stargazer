/* A generated set put on your side of the page's boards by Generate on the
 * Arena and Teams. The Load menu's one-side loader does it, so the enemy side,
 * the maps and the display switches stay. The set the generator page's Open
 * in Teams hands over (lib/pvp/generator/handover) opens as a new team
 * instead (TeamsView). */

import { useSelectionState } from '@/composables/useSelectionState'
import { buildSideLoadPlan } from '@/lib/teams/sideLoad'
import { useGrids } from '@/stores/grids'

export function useFillSide() {
  const grids = useGrids()
  const { clearTargetHex, clearLiftedHex } = useSelectionState()

  // False when the team does not decode as one side.
  return (team: string): boolean => {
    // A generated set holds no synergy hero.
    const plan = buildSideLoadPlan(team, false)
    if (!plan) return false
    grids.loadTeamSide(plan, { invert: false, scope: 'all' })
    // The load may have removed the unit a pending tap or lift points at.
    clearTargetHex()
    clearLiftedHex()
    return true
  }
}

// The set the generator page handed over, taken once, so a reload keeps the
// edits made since.
export const takeGeneratedSide = (): string | null => {
  const team: unknown = history.state?.generatedSide
  if (typeof team !== 'string') return null
  history.replaceState({ ...history.state, generatedSide: null }, '')
  return team
}
