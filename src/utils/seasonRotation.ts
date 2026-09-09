/* Per-season cleanup of the one binary value at rest. The arena autosave
 * carries no season stamp (links and the autosave share the stampless binary
 * format), so after a cutover its bare seasonal ids would silently resolve to
 * the new season's content that reuses them. A device-local marker records
 * the season the stored value was last aligned to; on mismatch the pass
 * strips seasonal references once and re-aligns the marker.
 *
 * PERMANENT, unlike the temporary migration shim: this runs at every future
 * cutover with no per-season code. An absent marker means the device last
 * wrote arena data on a build that predates the marker itself — the
 * first-stamped-season pool — so it converts correctly even for devices that
 * skip an entire release.
 *
 * Accepted race: an old-build tab left open across a cutover deploy can
 * autosave old-pool content after this pass ran, and the aligned marker never
 * re-fires — those bare ids then resolve as new-pool content. Bounded to the
 * arena (stamped JSON payloads self-heal at read) and inside the accepted
 * mis-render class.
 */

import { CURRENT_SEASON, stripSeasonalBoard } from '@/lib/seasonal'
import { readStorage, writeStorage } from '@/utils/storage'
import { decodeGridStateFromUrl, encodeGridStateToUrl } from '@/utils/urlStateManager'

const SEASON_KEY = 'stargazer.season'
const ARENA_KEY = 'stargazer.arena'

// The season the marker feature shipped in: a device with no marker last
// wrote arena data on a build no newer than this pool.
const PRE_MARKER_SEASON = 7

// Returns the season whose content was removed from the autosave (the
// caller's cue for the page banner), or null when nothing was dropped.
export function runSeasonRotationPass(): number | null {
  // Strict digit parse: Number() coercion accepts "", "0x10", "1e2" as
  // integers, and a corrupted marker must fall back to the seed, never to a
  // value that wrongly strips current-season content.
  const raw = readStorage(SEASON_KEY)
  const last = raw !== null && /^\d{1,4}$/.test(raw) ? Number(raw) : PRE_MARKER_SEASON
  if (last === CURRENT_SEASON) return null

  // Marker-last, like the storage pass: a failed write leaves it stale so the
  // strip retries next load, and a throw must not block startup.
  let stripped: number | null = null
  try {
    const stored = readStorage(ARENA_KEY)
    let ok = true
    if (stored !== null) {
      const state = decodeGridStateFromUrl(stored)
      // Undecodable values stay untouched; their reader discards them anyway.
      if (state) {
        const { d, ...board } = state
        const encoded = encodeGridStateToUrl({ ...stripSeasonalBoard(board), d })
        if (encoded !== stored) {
          ok = writeStorage(ARENA_KEY, encoded)
          if (ok) stripped = last
        }
      }
    }
    if (ok) writeStorage(SEASON_KEY, String(CURRENT_SEASON))
  } catch (err) {
    console.error('Season rotation pass failed, will retry next load:', err)
  }
  return stripped
}
