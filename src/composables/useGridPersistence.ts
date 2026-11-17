/* Persists the current board setup to localStorage and mirrors every change, so a
 * returning visitor sees their last state.
 *
 * Arena: one slot holding the same encoded `g` string a share link carries,
 * and one for the page's Honor Duel board holding its `hd` string. The page
 * shows one of the two boards at a time, and each slot's writer encodes a
 * board of its own kind only (useArenaBoards runs the change between them).
 *
 * Teams: one slot PER TEAM MODE, each holding an envelope of the encoded
 * multi-board string plus the saved-team provenance (sourceId). The autosave
 * watcher routes writes to the live mode's slot; the mode-switch sequence in
 * useTeamsRestore pauses it around rebuilds so a mode's slot is only ever written
 * while that mode's boards are live.
 *
 * A `?g=` link takes priority and overwrites the slot (the first autosave write
 * does this); the readonly /share view never starts autosave, so it can't persist.
 */

import { ref, watch, type Ref } from 'vue'

import {
  decodeGridStateFromUrl,
  decodeTeamData,
  encodeGridStateToUrl,
  encodeTeamData,
} from '@/lib/teams/codec'
import {
  packDisplayFlags,
  serializeGridState,
  serializeMultiGridState,
  unpackDisplayFlags,
  type DisplayFlags,
  type GridState,
} from '@/lib/teams/gridStateSerializer'
import { isTeamModeKey, type TeamModeKey } from '@/lib/teams/modes'
import { useArtifactStore } from '@/stores/artifact'
import { useDuelBoard } from '@/stores/duelBoard'
import { useGridStore } from '@/stores/grid'
import type { BoardKind } from '@/stores/gridContext'
import { useGrids } from '@/stores/grids'
import {
  ARENA_STORAGE_KEY,
  DUEL_BOARD_STORAGE_KEY,
  readStorage,
  writeStorage,
} from '@/utils/storage'

const TEAMS_MODE_KEY = 'stargazer.teams.mode'
const TEAMS_DISPLAY_KEY = 'stargazer.teams.display'

const teamsSlotKey = (mode: TeamModeKey): string => `stargazer.teams.active.${mode}`

/* Device-level Teams view preferences: all display toggles, shared across every
 * team mode (they are reading preferences, not board content). Stored as the
 * same packed byte the share-link `d` field uses so there is one flag schema. */
export const saveTeamsDisplayPrefs = (flags: DisplayFlags): void => {
  writeStorage(TEAMS_DISPLAY_KEY, String(packDisplayFlags(flags)))
}

export const loadTeamsDisplayPrefs = (): Required<DisplayFlags> | null => {
  const raw = readStorage(TEAMS_DISPLAY_KEY)
  if (raw === null) return null
  const packed = Number(raw)
  if (!Number.isInteger(packed)) return null
  return unpackDisplayFlags(packed)
}

/* A mode's persisted active team: the encoded snapshot and the saved team it
 * was loaded from / last saved to (null = not a saved team). Unknown keys are
 * ignored on load and dropped by the next write. */
export interface ActiveSlot {
  data: string
  sourceId: string | null
}

/* A mode's saved boards, or null when there are none to read. */
export const readTeamsSlot = (mode: TeamModeKey): ActiveSlot | null => {
  const raw = readStorage(teamsSlotKey(mode))
  if (!raw) return null
  try {
    const slot = JSON.parse(raw) as ActiveSlot
    if (typeof slot.data !== 'string') return null
    return {
      data: slot.data,
      sourceId: typeof slot.sourceId === 'string' ? slot.sourceId : null,
    }
  } catch {
    return null
  }
}

/* The Arena's or a Teams mode's saved boards, decoded; null when none are
 * saved or they do not decode. */
export const readSavedBoards = (page: 'arena' | TeamModeKey): GridState[] | null => {
  if (page === 'arena') {
    const raw = readStorage(ARENA_STORAGE_KEY)
    const board = raw ? decodeGridStateFromUrl(raw) : null
    return board && [board]
  }
  const slot = readTeamsSlot(page)
  return (slot && decodeTeamData(slot.data)?.boards) ?? null
}

export interface BoardWriter {
  load: () => string | null
  // Writes the board on screen now, when it is this writer's kind. Inert until
  // startAutosave: before the page's first restore the board on screen is an
  // empty stand-in, which must not replace the stored one.
  flush: () => void
  startAutosave: () => void
}

/* `snapshot` reads reactive board state, so the watch fires on any content/flag
 * change; the encoded string is the watch value, so it fires only on real
 * changes. While a board of another kind is on screen the value is null, which
 * is never written: a slot can only ever receive its own kind of board. */
const createBoardWriter = (key: string, kind: BoardKind, snapshot: () => string): BoardWriter => {
  const grids = useGrids()
  const encoded = (): string | null => (grids.active?.kind === kind ? snapshot() : null)
  // A board the browser refused to store. A change of board rebuilds from
  // what `load` returns, so the page keeps it for the way back.
  let unstored: string | null = null
  const write = (value: string | null): void => {
    if (value !== null) unstored = writeStorage(key, value) ? null : value
  }
  let started = false
  return {
    load: () => unstored ?? readStorage(key),
    flush: () => {
      if (started) write(encoded())
    },
    startAutosave: () => {
      if (started) return
      started = true
      // Write once up front so a just-restored link overwrites the saved slot,
      // then mirror every later change. Call after the initial restore so the
      // restore itself isn't double-counted.
      write(encoded())
      watch(encoded, write)
    },
  }
}

export function useArenaPersistence(getFlags: () => DisplayFlags): BoardWriter {
  const gridStore = useGridStore()
  const artifactStore = useArtifactStore()
  const grids = useGrids()
  return createBoardWriter(ARENA_STORAGE_KEY, 'arena', () =>
    encodeGridStateToUrl(
      serializeGridState(
        gridStore.getAllTiles,
        artifactStore.allyArtifactId,
        artifactStore.enemyArtifactId,
        getFlags(),
        grids.active?.getAttrs,
      ),
    ),
  )
}

export function useDuelPersistence(getFlags: () => DisplayFlags): BoardWriter {
  const duelBoard = useDuelBoard()
  return createBoardWriter(DUEL_BOARD_STORAGE_KEY, 'honorDuel', () =>
    duelBoard.snapshot(getFlags()),
  )
}

interface TeamsPersistence {
  // Last-used mode key, or null when absent/unknown.
  loadMode: () => TeamModeKey | null
  persistMode: (mode: TeamModeKey) => void
  // The mode's stored envelope, or null when absent or corrupt.
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

  const snapshot = (): string =>
    encodeTeamData(
      serializeMultiGridState(
        grids.contexts.map((ctx) => ({
          tiles: ctx.grid.getAllTiles(),
          allyArtifact: ctx.artifacts.ally,
          enemyArtifact: ctx.artifacts.enemy,
          map: ctx.currentMap,
          getAttrs: ctx.getAttrs,
        })),
        grids.activeId,
        getFlags(),
        mode.value,
      ),
    )

  const write = (encoded: string): void => {
    const slot: ActiveSlot = { data: encoded, sourceId: sourceId.value }
    writeStorage(teamsSlotKey(mode.value), JSON.stringify(slot))
  }

  return {
    loadMode: () => {
      const stored = readStorage(TEAMS_MODE_KEY)
      return isTeamModeKey(stored) ? stored : null
    },
    persistMode: (next) => writeStorage(TEAMS_MODE_KEY, next),
    load: readTeamsSlot,
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
