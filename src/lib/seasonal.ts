/* Season provenance for stored payloads. Seasonal artifact/phantimal ids are
 * REUSED each season (the rotation policy), so a bare id cannot say which
 * season's content it names. Every serialized `MultiGridState` therefore
 * carries `season` — the content pool the snapshot was built from — and a
 * payload whose season is not the current one has its seasonal references
 * treated as retired: masked to a "S{n}" placeholder on display surfaces and
 * stripped before they can reach live boards, where the reused id would
 * silently resolve to the new season's content.
 *
 * "Current season" is deploy-derived, never calendar-derived: it is the max
 * `season` across the loaded seasonal data files, so the boundary flips
 * exactly when a cutover deploy ships (0 when the seasonal dirs are empty,
 * which correctly retires every stamp).
 *
 * An UNSTAMPED payload has no provenance and passes through everywhere as
 * current-pool content. During the shim window the JSON choke point stamps
 * legacy payloads with season 7 and the storage pass persists it; per the
 * shims-are-always-temporary policy there is no permanent default, so an
 * unstamped payload surfacing after the window (an old export file) simply
 * resolves its seasonal ids against the current pool — accepted, like every
 * other post-shim legacy outcome.
 */

import { loadArtifacts, loadPhantimals } from '@/utils/dataLoader'
import type { BoardState, MultiGridState } from '@/utils/gridStateSerializer'

export const CURRENT_SEASON: number = Math.max(
  0,
  ...loadArtifacts().map((artifact) => artifact.season),
  ...loadPhantimals().map((phantimal) => phantimal.season),
)

// The pre-season artifacts (season 0) persist across rollovers; only they may
// survive in a retired payload.
const PERMANENT_ARTIFACT_IDS = new Set(
  loadArtifacts()
    .filter((artifact) => artifact.season === 0)
    .map((artifact) => artifact.id),
)

export const isPermanentArtifactId = (id: number): boolean => PERMANENT_ARTIFACT_IDS.has(id)

export const isRetiredSeason = (season: number): boolean => season !== CURRENT_SEASON

/* Remove a board's seasonal content unconditionally: all phantimals, and
 * artifact ids outside the permanent set (nulled per side so the other side's
 * permanent artifact survives; a fully-null pair drops). The retired gate
 * lives in the payload-level wrapper; the season rotation pass strips without
 * one (its marker is the staleness signal). */
export function stripSeasonalBoard(board: BoardState): BoardState {
  const stripped = { ...board }
  delete stripped.s
  if (stripped.a) {
    const a = stripped.a.map((id) => (id !== null && isPermanentArtifactId(id) ? id : null))
    if (a.every((id) => id === null)) delete stripped.a
    else stripped.a = a
  }
  return stripped
}

export function stripRetiredSeasonal(state: MultiGridState): MultiGridState {
  if (state.season === undefined || !isRetiredSeason(state.season)) return state
  return { ...state, boards: state.boards.map(stripSeasonalBoard) }
}

/* Whether the payload references any rotating content — the same predicate
 * that decides what a strip would remove, and what makes `season` part of the
 * team's identity: a reused id names a different artifact each season, so
 * equality must include the stamp exactly when refs like this exist. */
export function hasSeasonalContent(state: MultiGridState): boolean {
  return state.boards.some(
    (board) =>
      (board.s?.length ?? 0) > 0 ||
      (board.a?.some((id) => id !== null && !isPermanentArtifactId(id)) ?? false),
  )
}

// True when loading this payload onto live boards would drop something — the
// caller's cue to raise the season notice.
export function hasRetiredSeasonal(state: MultiGridState): boolean {
  if (state.season === undefined || !isRetiredSeason(state.season)) return false
  return hasSeasonalContent(state)
}
