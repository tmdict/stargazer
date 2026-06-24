/* Persists the current board setup to localStorage and mirrors every change, so a
 * returning visitor sees their last state. The stored value is the same encoded
 * `g` string a share link carries, so it round-trips through the existing URL
 * serializer (binary for the Arena, base64-JSON for the 5 v 5 boards).
 *
 * A `?g=` link takes priority and overwrites the slot (the first autosave write
 * does this); the readonly /share view never starts autosave, so it can't persist.
 */

import { watch } from 'vue'

import { useArtifactStore } from '@/stores/artifact'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import {
  serializeGridState,
  serializeMultiGridState,
  type DisplayFlags,
} from '@/utils/gridStateSerializer'
import { encodeGridStateToUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const ARENA_KEY = 'stargazer.arena'
const TEAMS_KEY = 'stargazer.teams'

const readSlot = (key: string): string | null => {
  if (import.meta.env.SSR) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeSlot = (key: string, value: string): void => {
  if (import.meta.env.SSR) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Best-effort: private mode, disabled storage, or quota. Persistence is optional.
  }
}

interface GridPersistence {
  load: () => string | null
  startAutosave: () => void
}

// `snapshot` reads reactive board state, so the watch fires on any content/flag
// change; the encoded string is the watch value, so it fires only on real changes.
const createPersistence = (key: string, snapshot: () => string): GridPersistence => ({
  load: () => readSlot(key),
  startAutosave: () => {
    // Write once up front so a just-restored `?g=` link overwrites the saved slot,
    // then mirror every later change. Call after the initial restore so the restore
    // itself isn't double-counted.
    writeSlot(key, snapshot())
    watch(snapshot, (encoded) => writeSlot(key, encoded))
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

export function useTeamsPersistence(getFlags: () => DisplayFlags): GridPersistence {
  const grids = useGrids()
  return createPersistence(TEAMS_KEY, () =>
    encodeMultiGridStateToUrl(
      serializeMultiGridState(
        grids.contexts.map((ctx) => ({
          tiles: ctx.grid.getAllTiles(),
          allyArtifact: ctx.artifacts.ally,
          enemyArtifact: ctx.artifacts.enemy,
          getParagon: ctx.getParagon,
        })),
        grids.activeId,
        getFlags(),
      ),
    ),
  )
}
