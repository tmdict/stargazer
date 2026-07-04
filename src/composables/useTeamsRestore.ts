/* The Teams page's restore/switch orchestrator — the sole initiator of board-count
 * changes on /teams. Owns the active mode, the saved-team provenance (sourceId),
 * and the mode-aware persistence, and runs the critical switch sequence:
 *
 *   pause → flush old slot → set mode → restore-or-default (single rebuild) →
 *   adopt sourceId → flags/wrap/sizing → resume + baseline write.
 *
 * A mode's slot is only ever written while that mode's boards are live, which is
 * the invariant that keeps per-mode state independent. All bulk state application
 * goes through urlState.restoreMultiFromEncodedState (never a bespoke loader): it
 * encapsulates per-board apply ordering, companion settling, cross-board dedupe,
 * and the phantimal baseline re-seed.
 */

import { ref, type Ref } from 'vue'

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
  // The wrap toggle's model: forced off when the target mode can't wrap, so the
  // serialized wrap bit stays 0 for non-wrap modes.
  wrapBoards: Ref<boolean>
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

  // Apply an encoded payload through the single restore path. Flags are adopted
  // only when the payload actually carries them (canonical saved-team data does
  // not, so Select never clobbers the viewer's toggles).
  const applyEncoded = (encoded: string): boolean => {
    const result = urlStateStore.restoreMultiFromEncodedState(encoded)
    if (result.success && result.hasDisplayFlags && result.displayFlags) {
      options.applyFlags(result.displayFlags)
    }
    return result.success
  }

  // Rebuild hygiene shared by every path: boards share hex ids so stale selection
  // must drop, wrap is a 5-board-only layout, and the page pins its own sizing.
  const afterRebuild = (mode: TeamModeKey): void => {
    clearTargetHex()
    clearLiftedHex()
    if (!TEAM_MODES[mode].canWrap) options.wrapBoards.value = false
    options.applySize()
  }

  // Restore the mode's slot, or build the mode's fresh defaults when the slot is
  // absent/corrupt. Exactly one rebuild either way (the restore path rebuilds
  // internally as this orchestrator's delegated mechanism).
  const restoreOrDefault = (mode: TeamModeKey): void => {
    const slot = persistence.load(mode)
    const restored = slot !== null && applyEncoded(slot.data)
    if (!restored) {
      const cfg = TEAM_MODES[mode]
      grids.setGridCount(cfg.boardCount, cfg.defaultMaps)
    }
    afterRebuild(mode)
    sourceId.value = restored && slot ? resolveSource(slot.sourceId) : null
  }

  /* Switch to another mode. Always rebuilds — even between equal-count modes
   * (5v5 ↔ 5v5sl differ in maps and state), unlike the old tab watcher's
   * count-equality optimization. */
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

  /* Replace the active team with an encoded payload (a saved team's canonical
   * data), switching mode first when needed. `source` becomes the provenance the
   * Save button updates. Falls back to the mode's defaults if the payload fails
   * to decode (corrupt record), returning false. */
  const applyTeamData = (mode: TeamModeKey, encoded: string, source: string | null): boolean => {
    persistence.setPaused(true)
    persistence.flush()
    activeMode.value = mode
    persistence.persistMode(mode)
    const applied = applyEncoded(encoded)
    if (!applied) {
      const cfg = TEAM_MODES[mode]
      grids.setGridCount(cfg.boardCount, cfg.defaultMaps)
    }
    afterRebuild(mode)
    sourceId.value = applied ? source : null
    persistence.setPaused(false)
    persistence.flush()
    return applied
  }

  /* Initial page load: a ?g= link (mode-routed and shape-normalized) wins over the
   * last-used mode's slot; a link that fails to decode falls back to the slot so
   * autosave can't wipe it. Arms the autosave, whose first write commits whatever
   * was restored. */
  const initialize = (sharedLink: string | null): InitializeResult => {
    let linkFailed = false

    if (sharedLink) {
      const decoded = decodeMultiGridStateFromUrl(sharedLink)
      if (decoded && decoded.boards.length > 0) {
        const mode = resolveTeamMode(decoded)
        const normalized = encodeMultiGridStateToUrl(normalizeTeamPayload(decoded, mode))
        activeMode.value = mode
        persistence.persistMode(mode)
        if (applyEncoded(normalized)) {
          afterRebuild(mode)
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

  return {
    activeMode,
    sourceId,
    initialize,
    switchMode,
    applyTeamData,
    flush: () => persistence.flush(),
  }
}
