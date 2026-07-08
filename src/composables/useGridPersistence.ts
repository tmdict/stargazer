/* Persists the current board setup to localStorage and mirrors every change, so a
 * returning visitor sees their last state.
 *
 * Arena: one slot holding the same encoded `g` string a share link carries.
 *
 * Teams: one slot PER TEAM MODE, each holding a versioned envelope of the encoded
 * multi-board string plus the saved-team provenance (sourceId). The autosave
 * watcher routes writes to the live mode's slot; the mode-switch sequence in
 * useTeamsRestore pauses it around rebuilds so a mode's slot is only ever written
 * while that mode's boards are live.
 *
 * A `?g=` link takes priority and overwrites the slot (the first autosave write
 * does this); the readonly /share view never starts autosave, so it can't persist.
 */

import { ref, watch, type Ref } from 'vue'

import { isTeamModeKey, TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { useArtifactStore } from '@/stores/artifact'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import {
  serializeGridState,
  serializeMultiGridState,
  type DisplayFlags,
} from '@/utils/gridStateSerializer'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import { encodeGridStateToUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const ARENA_KEY = 'stargazer.arena'
// Obsolete single-slot key; deleted on sight so stale data can't linger.
const LEGACY_TEAMS_KEY = 'stargazer.teams'
const TEAMS_MODE_KEY = 'stargazer.teams.mode'

export const teamsSlotKey = (mode: TeamModeKey): string => `stargazer.teams.active.${mode}`

/* A mode's persisted active team: the encoded snapshot, the saved team it was
 * loaded from / last saved to (null = not a saved team), and a fingerprint of
 * the mode's default maps at write time. A stale fingerprint discards the slot
 * on load: updating a mode's default map list (a new Supreme League season)
 * deliberately hard-resets that mode's active boards while saved teams keep
 * their own data. Versioned so a future shape change is detected, not shape-read. */
export interface ActiveSlot {
  v: 1
  data: string
  sourceId: string | null
  defaults: string
}

const defaultsFingerprint = (mode: TeamModeKey): string => TEAM_MODES[mode].defaultMaps.join(',')

interface GridPersistence {
  load: () => string | null
  startAutosave: () => void
}

// `snapshot` reads reactive board state, so the watch fires on any content/flag
// change; the encoded string is the watch value, so it fires only on real changes.
const createPersistence = (key: string, snapshot: () => string): GridPersistence => ({
  load: () => readStorage(key),
  startAutosave: () => {
    // Write once up front so a just-restored `?g=` link overwrites the saved slot,
    // then mirror every later change. Call after the initial restore so the restore
    // itself isn't double-counted.
    writeStorage(key, snapshot())
    watch(snapshot, (encoded) => writeStorage(key, encoded))
  },
})

export function useArenaPersistence(getFlags: () => DisplayFlags): GridPersistence {
  const gridStore = useGridStore()
  const artifactStore = useArtifactStore()
  const grids = useGrids()
  return createPersistence(ARENA_KEY, () =>
    encodeGridStateToUrl(
      serializeGridState(
        gridStore.getAllTiles,
        artifactStore.allyArtifactId,
        artifactStore.enemyArtifactId,
        getFlags(),
        grids.active?.getParagon,
      ),
    ),
  )
}

export interface TeamsPersistence {
  // Last-used mode key, or null when absent/unknown.
  loadMode: () => TeamModeKey | null
  persistMode: (mode: TeamModeKey) => void
  // The mode's stored envelope, or null when absent/corrupt/wrong version.
  load: (mode: TeamModeKey) => ActiveSlot | null
  // The live boards as an encoded string (reactive reads, usable in computeds).
  snapshot: () => string
  // Write the current snapshot to the LIVE mode's slot immediately.
  flush: () => void
  setPaused: (paused: boolean) => void
  startAutosave: () => void
}

export function useTeamsPersistence(
  mode: Ref<TeamModeKey>,
  sourceId: Ref<string | null>,
  getFlags: () => DisplayFlags,
): TeamsPersistence {
  const grids = useGrids()
  const paused = ref(false)
  let started = false

  removeStorage(LEGACY_TEAMS_KEY)

  const snapshot = (): string =>
    encodeMultiGridStateToUrl(
      serializeMultiGridState(
        grids.contexts.map((ctx) => ({
          tiles: ctx.grid.getAllTiles(),
          allyArtifact: ctx.artifacts.ally,
          enemyArtifact: ctx.artifacts.enemy,
          map: ctx.currentMap,
          getParagon: ctx.getParagon,
        })),
        grids.activeId,
        getFlags(),
        mode.value,
      ),
    )

  const write = (encoded: string): void => {
    const slot: ActiveSlot = {
      v: 1,
      data: encoded,
      sourceId: sourceId.value,
      defaults: defaultsFingerprint(mode.value),
    }
    writeStorage(teamsSlotKey(mode.value), JSON.stringify(slot))
  }

  return {
    loadMode: () => {
      const stored = readStorage(TEAMS_MODE_KEY)
      return isTeamModeKey(stored) ? stored : null
    },
    persistMode: (next) => writeStorage(TEAMS_MODE_KEY, next),
    load: (target) => {
      const raw = readStorage(teamsSlotKey(target))
      if (!raw) return null
      try {
        const slot = JSON.parse(raw) as ActiveSlot
        if (slot.v !== 1 || typeof slot.data !== 'string') return null
        // Stale defaults = the mode's map list changed since this slot was
        // written; discard so the mode hard-resets onto the new defaults.
        if (slot.defaults !== defaultsFingerprint(target)) return null
        return {
          v: 1,
          data: slot.data,
          sourceId: typeof slot.sourceId === 'string' ? slot.sourceId : null,
          defaults: slot.defaults,
        }
      } catch {
        return null
      }
    },
    snapshot,
    // Inert until startAutosave marks this instance as the slot's writer: on a
    // degraded page (data never loaded, initialize skipped) a flush would
    // overwrite a mode's persisted boards with placeholder state.
    flush: () => {
      if (started) write(snapshot())
    },
    setPaused: (value) => {
      paused.value = value
    },
    startAutosave: () => {
      // Guard against double registration: the watcher is page-scoped and there
      // must be exactly one writer per page instance.
      if (started) return
      started = true
      write(snapshot())
      // Default (pre) flush, matching the Arena autosave: with the synchronous
      // switch sequence the callback coalesces to one post-sequence run that
      // already sees the new mode. The pause flag is defense-in-depth for any
      // future async step in the sequence; do not remove it as dead code.
      watch([snapshot, sourceId], ([encoded]) => {
        if (!paused.value) write(encoded)
      })
    },
  }
}
