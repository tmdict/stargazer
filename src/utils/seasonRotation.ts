/* Per-season cleanup of the one binary value at rest. The arena autosave
 * carries no season stamp (links and the autosave share the stampless binary
 * format), so after a cutover its bare seasonal ids would silently resolve to
 * the new season's content that reuses them. A device-local marker records
 * the season the stored value was last aligned to; on mismatch the pass
 * strips seasonal references once and re-aligns the marker.
 *
 * PERMANENT, unlike the upgradeMigration shim: this runs at every future
 * cutover with no per-season code. An absent marker means the device last
 * wrote arena data on a build that predates the marker itself — the
 * first-stamped-season pool — so it converts correctly even for devices that
 * skip an entire release.
 */

import { CURRENT_SEASON, FIRST_STAMPED_SEASON, stripRetiredSeasonalBoard } from '@/lib/seasonal'
import { readStorage, writeStorage } from '@/utils/storage'
import { decodeGridStateFromUrl, encodeGridStateToUrl } from '@/utils/urlStateManager'

const SEASON_KEY = 'stargazer.season'
const ARENA_KEY = 'stargazer.arena'

export function runSeasonRotationPass(): void {
  const stored = Number(readStorage(SEASON_KEY) ?? FIRST_STAMPED_SEASON)
  const last = Number.isInteger(stored) ? stored : FIRST_STAMPED_SEASON
  if (last === CURRENT_SEASON) return

  // Marker-last, like the storage pass: a failed write leaves it stale so the
  // strip retries next load, and a throw must not block startup.
  try {
    const raw = readStorage(ARENA_KEY)
    let ok = true
    if (raw !== null) {
      const state = decodeGridStateFromUrl(raw)
      // Undecodable values stay untouched; their reader discards them anyway.
      if (state) {
        const { d, ...board } = state
        const encoded = encodeGridStateToUrl({ ...stripRetiredSeasonalBoard(board), d })
        ok = encoded === raw || writeStorage(ARENA_KEY, encoded)
      }
    }
    if (ok) writeStorage(SEASON_KEY, String(CURRENT_SEASON))
  } catch (err) {
    console.error('Season rotation pass failed, will retry next load:', err)
  }
}
