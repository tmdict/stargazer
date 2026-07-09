/* The Teams page's restore/switch orchestrator, the sole initiator of board-count
 * changes on /teams. Owns the active mode, the saved-team provenance (sourceId),
 * and the mode-aware persistence, and runs the critical switch sequence:
 *
 *   pause → flush old slot → set mode → restore-or-default (single rebuild) →
 *   adopt sourceId → sizing → resume + baseline write.
 *
 * A mode's slot is only ever written while that mode's boards are live, which is
 * the invariant that keeps per-mode state independent. All bulk state application
 * goes through urlState.restoreMultiFromEncodedState (never a bespoke loader): it
 * encapsulates per-board apply ordering, companion settling, cross-board dedupe,
 * and the phantimal baseline re-seed.
 */

import { ref } from 'vue'

import { useSelectionState } from '@/composables/useSelectionState'
import {
  DEFAULT_TEAM_MODE,
  normalizeTeamPayload,
  resolveTeamMode,
  TEAM_MODES,
  type TeamModeKey,
} from '@/lib/teams/modes'
import { useGrids } from '@/stores/grids'
import { useUrlStateStore } from '@/stores/urlState'
import type { DisplayFlags } from '@/utils/gridStateSerializer'
import { decodeMultiGridStateFromUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import { useTeamsPersistence } from './useGridPersistence'

export interface TeamsRestoreOptions {
  getFlags: () => DisplayFlags
  applyFlags: (flags: DisplayFlags) => void
  // Page sizing re-asserted after every rebuild (hexSizeMode pinning).
  applySize: () => void
  // Resolves a stored sourceId against the saved-team library; unresolvable ids
  // normalize to null so stale provenance self-heals at slot adoption.
  resolveSourceId?: (id: string | null) => string | null
}

export interface InitializeResult {
  // A ?g= link was present and applied.
  linkLoaded: boolean
  // A ?g= link was present but failed to decode (the saved slot was used instead).
  linkFailed: boolean
}

export function useTeamsRestore(options: TeamsRestoreOptions) {
  const grids = useGrids()
  const urlStateStore = useUrlStateStore()
  const { clearTargetHex, clearLiftedHex } = useSelectionState()

  const activeMode = ref<TeamModeKey>(DEFAULT_TEAM_MODE)
  const sourceId = ref<string | null>(null)
  const persistence = useTeamsPersistence(activeMode, sourceId, options.getFlags)

  const resolveSource = (id: string | null): string | null =>
    options.resolveSourceId ? options.resolveSourceId(id) : id

  /* Display flags are device-level view preferences, so slot and saved-team
   * restores ignore a payload's `d` entirely (adoptFlags false); only a `?g=`
   * link adopts it, since sharing the sharer's exact view is the point of a
   * link. Slots keep writing full flags regardless: the snapshot doubles as the
   * share payload (one serialization path). */
  const applyEncoded = (encoded: string, adoptFlags: boolean): boolean => {
    const result = urlStateStore.restoreMultiFromEncodedState(encoded)
    if (adoptFlags && result.success && result.hasDisplayFlags && result.displayFlags) {
      options.applyFlags(result.displayFlags)
    }
    return result.success
  }

  // Rebuild hygiene shared by every path: boards share hex ids so stale selection
  // must drop, and the page pins its own sizing. A stray wrap bit needs no reset
  // here: every wrap consumer gates on the mode's canWrap / board count.
  const afterRebuild = (): void => {
    clearTargetHex()
    clearLiftedHex()
    options.applySize()
  }

  const buildModeDefaults = (mode: TeamModeKey): void => {
    const cfg = TEAM_MODES[mode]
    grids.setGridCount(cfg.boardCount, cfg.defaultMaps)
  }

  // Exactly one rebuild either way: a successful restore rebuilds internally (as
  // this orchestrator's delegated mechanism), so defaults are built only when it
  // didn't run.
  const restoreOrDefault = (mode: TeamModeKey): void => {
    const slot = persistence.load(mode)
    const restored = slot !== null && applyEncoded(slot.data, false)
    if (!restored) buildModeDefaults(mode)
    afterRebuild()
    sourceId.value = restored && slot ? resolveSource(slot.sourceId) : null
  }

  /* Always rebuilds: equal-count modes (5v5 ↔ 5v5sl) still differ in maps and
   * state, so a count-equality shortcut would silently share boards. */
  const switchMode = (next: TeamModeKey): void => {
    if (next === activeMode.value) return
    persistence.setPaused(true)
    persistence.flush()
    activeMode.value = next
    persistence.persistMode(next)
    restoreOrDefault(next)
    persistence.setPaused(false)
    persistence.flush()
  }

  /* Load a saved team as the active team. `source` becomes the provenance the
   * Save button updates; a corrupt payload falls back to the mode's defaults
   * with provenance cleared (returns false). */
  const applyTeamData = (mode: TeamModeKey, encoded: string, source: string | null): boolean => {
    persistence.setPaused(true)
    persistence.flush()
    activeMode.value = mode
    persistence.persistMode(mode)
    const applied = applyEncoded(encoded, false)
    if (!applied) buildModeDefaults(mode)
    afterRebuild()
    sourceId.value = applied ? source : null
    persistence.setPaused(false)
    persistence.flush()
    return applied
  }

  /* Initial page load: a ?g= link (mode-routed, shape-normalized) wins over the
   * last-used mode's slot; a link that fails to decode is treated as absent so
   * autosave can't wipe the slot. The autosave's first write commits whatever
   * was restored. */
  const initialize = (sharedLink: string | null): InitializeResult => {
    let linkFailed = false

    if (sharedLink) {
      const decoded = decodeMultiGridStateFromUrl(sharedLink)
      if (decoded && decoded.boards.length > 0) {
        const mode = resolveTeamMode(decoded)
        const normalized = encodeMultiGridStateToUrl(normalizeTeamPayload(decoded, mode))
        activeMode.value = mode
        if (applyEncoded(normalized, true)) {
          // Persisted only on success: a link that decodes but fails to apply
          // must not leave its mode as the remembered one for the fallback.
          persistence.persistMode(mode)
          afterRebuild()
          sourceId.value = null
          persistence.startAutosave()
          return { linkLoaded: true, linkFailed: false }
        }
      }
      linkFailed = true
    }

    activeMode.value = persistence.loadMode() ?? DEFAULT_TEAM_MODE
    persistence.persistMode(activeMode.value)
    restoreOrDefault(activeMode.value)
    persistence.startAutosave()
    return { linkLoaded: false, linkFailed }
  }

  /* Degraded startup (game data failed to load): build the active mode's
   * default boards with no persistence reads or writes; the boards are
   * display-only placeholders and must not touch any mode's slot. */
  const buildDefaults = (): void => {
    buildModeDefaults(activeMode.value)
    afterRebuild()
  }

  /* File → New: fresh default boards with provenance detached, so Save can no
   * longer overwrite the team the boards came from. Clear stays a content-only
   * operation that keeps the tie. */
  const newTeam = (): void => {
    persistence.setPaused(true)
    buildDefaults()
    sourceId.value = null
    persistence.setPaused(false)
    persistence.flush()
  }

  return {
    activeMode,
    sourceId,
    initialize,
    buildDefaults,
    newTeam,
    switchMode,
    applyTeamData,
    // Reactive reads, usable in computeds (the dirty compare's live side).
    snapshot: () => persistence.snapshot(),
  }
}
