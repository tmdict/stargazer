/* One-time remap of the two persisted display-flag bytes from the pre-gridInfo
 * bit layout (0 gridInfo, 1 perspective, 2 skills, 3 teamView, 4 inverted,
 * 5 wrap) to the current one. All old-layout knowledge lives here; the
 * serializer knows only the current layout. Called solely from
 * useGridInfoPrefs' seed branch, after the stargazer.prefs marker write lands,
 * so the remap cannot run twice on one device. Accepted residual races,
 * display bytes only and self-healing on the next toggle: two tabs racing the
 * first load can both remap, and a failed marker write followed by a
 * same-session arena autosave (already new-layout) leaves that byte to be
 * scrambled by the retried remap.
 *
 * TEMPORARY, planned for deletion about a week after release, once active
 * users have migrated.
 *
 * REMOVAL RUNBOOK (step-by-step, written for the LLM agent doing the
 * deletion):
 * 1. Delete this file (src/utils/gridInfoMigration.ts).
 * 2. Delete tests/unit/utils/gridInfoMigration.test.ts; nothing else tests
 *    the remap.
 * 3. In src/composables/useGridInfoPrefs.ts:
 *    - remove the remapLegacyDisplayBytes import;
 *    - in initStorage's `raw === null` branch, replace the
 *      `if (seedStorage()) { remapLegacyDisplayBytes() }` block with a plain
 *      `seedStorage()` call;
 *    - trim the remap and marker-first clauses from the module header and
 *      the initStorage comment (the key's absence then just means "first run
 *      on this device", not "not yet migrated").
 * 4. Delete the ordering comments naming gridInfoMigration above the
 *    useGridInfoPrefs() calls in src/views/HomeView.vue and
 *    src/views/TeamsView.vue; the calls stay, but with the remap gone
 *    nothing depends on their position relative to the persistence reads.
 * 5. Touch nothing else: useGridInfoPrefs' seeding, the stargazer.prefs key
 *    and its gridInfo slice, and the current display-flags bit layout are
 *    all permanent, not part of this shim.
 * 6. Verify: `grep -ri gridinfomigration src tests` returns nothing, then
 *    `npm run lint`, `npm run type-check`, and `npm run test` pass with no
 *    further edits.
 * Expected user-visible consequence, not a regression: a device that never
 * loaded the app while the shim lived gets one scrambled set of display
 * toggles (board content untouched) that self-heals on its next toggle.
 *
 * The storage keys are duplicated here (not exported from useGridPersistence)
 * so deleting this file leaves no orphaned exports behind.
 */

import { packDisplayFlags } from '@/utils/gridStateSerializer'
import { readStorage, writeStorage } from '@/utils/storage'
import { decodeGridStateFromUrl, encodeGridStateToUrl } from '@/utils/urlStateManager'

const ARENA_KEY = 'stargazer.arena'
const TEAMS_DISPLAY_KEY = 'stargazer.teams.display'

// Pre-gridInfo bit positions; bit 0 (grid info) is discarded, the new master
// pref seeds to its own default instead.
const OLD_PERSPECTIVE = 1 << 1
const OLD_SKILLS = 1 << 2
const OLD_TEAM_VIEW = 1 << 3
const OLD_INVERTED = 1 << 4
const OLD_WRAP = 1 << 5

const remapByte = (old: number): number =>
  packDisplayFlags({
    showPerspective: !!(old & OLD_PERSPECTIVE),
    showSkills: !!(old & OLD_SKILLS),
    teamView: !!(old & OLD_TEAM_VIEW),
    inverted: !!(old & OLD_INVERTED),
    wrap: !!(old & OLD_WRAP),
  })

// A missing key, non-integer byte, undecodable slot, or slot without a `d`
// byte is skipped untouched; persistence is best-effort like all storage code.
export function remapLegacyDisplayBytes(): void {
  const teamsRaw = readStorage(TEAMS_DISPLAY_KEY)
  if (teamsRaw !== null) {
    const packed = Number(teamsRaw)
    if (Number.isInteger(packed)) {
      writeStorage(TEAMS_DISPLAY_KEY, String(remapByte(packed)))
    }
  }

  const arenaRaw = readStorage(ARENA_KEY)
  if (arenaRaw !== null) {
    const state = decodeGridStateFromUrl(arenaRaw)
    if (state && typeof state.d === 'number') {
      state.d = remapByte(state.d)
      writeStorage(ARENA_KEY, encodeGridStateToUrl(state))
    }
  }
}
