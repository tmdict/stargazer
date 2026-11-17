/* The Arena page's two boards. One is on screen at a time: the Arena board, or
 * the Honor Duel board while the Honor Duel tab is open. Each has a stored
 * value of its own, written only while its board is on screen
 * (useGridPersistence).
 *
 * A change of board writes the leaving board once, then rebuilds from the
 * other's stored value. The view switches belong to the page, so a change
 * leaves them as they are; a board's stored switches are read only when the
 * page opens on it.
 */

import { computed } from 'vue'

import { useArenaPick } from '@/composables/useArenaPick'
import { useArenaPersistence, useDuelPersistence } from '@/composables/useGridPersistence'
import { useSelectionState } from '@/composables/useSelectionState'
import { unpackDisplayFlags, type DisplayFlags } from '@/lib/teams/gridStateSerializer'
import { useBoardRestore } from '@/stores/boardRestore'
import { useDuelBoard } from '@/stores/duelBoard'
import type { BoardKind } from '@/stores/gridContext'
import { useGrids } from '@/stores/grids'

export function useArenaBoards(getFlags: () => DisplayFlags) {
  const grids = useGrids()
  const boardRestore = useBoardRestore()
  const duelBoard = useDuelBoard()
  const arenaPick = useArenaPick()
  const { clearTargets, clearLiftedHex } = useSelectionState()
  const writers = {
    arena: useArenaPersistence(getFlags),
    honorDuel: useDuelPersistence(getFlags),
  }

  const kind = computed((): BoardKind => grids.active?.kind ?? 'arena')

  // The Arena's passing choices, which no stored value holds and a rebuild of
  // the boards clears: kept while the Honor Duel board is on screen.
  let aside: {
    board: string | null
    synergy: boolean
    nonSeasonal: boolean
    hiddenSkills: ReadonlySet<string>
  } | null = null

  // The stored Arena board, with its view switches when the page opens on it.
  const openArena = (): Required<DisplayFlags> | undefined => {
    grids.setGridCount(1)
    const result = boardRestore.restoreFromEncodedState(writers.arena.load())
    arenaPick.restore()
    return result.displayFlags
  }

  // The stored Honor Duel board, or the one a link holds, which then replaces
  // the stored one at the next write; with its view switches as openArena. A
  // text that is no board's leaves an empty board on screen.
  const openDuel = (link?: string): Required<DisplayFlags> | undefined => {
    const state = duelBoard.open(link ?? writers.honorDuel.load())
    return state ? unpackDisplayFlags(state.d) : undefined
  }

  const show = (next: BoardKind): void => {
    if (next === kind.value) return
    writers[kind.value].flush()
    if (next === 'honorDuel') {
      aside = {
        board: writers.arena.load(),
        synergy: grids.synergy,
        nonSeasonal: grids.nonSeasonal,
        hiddenSkills: grids.hiddenSkills,
      }
      openDuel()
    } else {
      openArena()
      // They belong to the board that left: one another tab stored since
      // comes back without them.
      if (aside && aside.board === writers.arena.load()) {
        // The Synergy box may be ticked with no synergy hero placed yet.
        grids.synergy ||= aside.synergy
        grids.nonSeasonal = aside.nonSeasonal
        grids.hiddenSkills = aside.hiddenSkills
      }
      aside = null
    }
    // A tapped tile or a lifted hero named the board that left.
    clearTargets()
    clearLiftedHex()
  }

  const startAutosave = (): void => {
    writers.arena.startAutosave()
    writers.honorDuel.startAutosave()
  }

  return { kind, show, openArena, openDuel, startAutosave }
}
