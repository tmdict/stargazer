/* The Arena's map dropdown pick, kept on the device under
 * `stargazer.arena.variant` as the mode of the row picked, `sl` or `gd`. The
 * Arena's saved board and its links carry no map key, so the pick is kept
 * apart from them and a link opens as a plain map. The board carries the
 * mode's buffs while it stays on the map picked (useGrids' buffMode). */

import { TEAM_VARIANTS, type TeamVariantKey } from '@/lib/teams/modes'
import { useGrids } from '@/stores/grids'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

const PICK_KEY = 'stargazer.arena.variant'

const isVariantKey = (value: string | null): value is TeamVariantKey =>
  value !== null && Object.hasOwn(TEAM_VARIANTS, value)

export function useArenaPick() {
  const grids = useGrids()

  // A dropdown row: the board moves onto its map with everything on it.
  const pick = (mode: TeamVariantKey, map: string): void => {
    const board = grids.active
    if (!board || !grids.moveToMap(board, map)) return
    grids.arenaPick = { mode, map }
    writeStorage(PICK_KEY, mode)
  }

  // The board as a plain map: a Maps tab pick, a Map Editor change, a link
  // opened, or a move off the map picked.
  const drop = (): void => {
    grids.arenaPick = null
    removeStorage(PICK_KEY)
  }

  // Once the saved board is back: the stored pick holds only when the board's
  // map is on its mode's list, a map being there at most once.
  const restore = (): void => {
    const mode = readStorage(PICK_KEY)
    const map = grids.active?.currentMap
    if (isVariantKey(mode) && map !== undefined && TEAM_VARIANTS[mode].maps.includes(map)) {
      grids.arenaPick = { mode, map }
    } else if (mode !== null) {
      removeStorage(PICK_KEY)
    }
  }

  return { pick, drop, restore }
}
