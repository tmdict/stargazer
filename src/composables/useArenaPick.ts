/* The Arena's map pick, kept on the device under `stargazer.arena.variant` as
 * the mode of the slot picked, `sl` or `gd`. The Arena's saved board and its
 * links carry no map key, so the pick is kept apart from them and a link opens
 * as a plain map. The board carries the mode's buffs while it stays on the map
 * picked (useGrids' buffMode). */

import { computed } from 'vue'

import { useSelectionState } from '@/composables/useSelectionState'
import { TEAM_VARIANTS, type TeamVariantKey } from '@/lib/teams/modes'
import { useGrids } from '@/stores/grids'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

const PICK_KEY = 'stargazer.arena.variant'

const isVariantKey = (value: string | null): value is TeamVariantKey =>
  value !== null && Object.hasOwn(TEAM_VARIANTS, value)

export interface ArenaMapSlot {
  // `SL1` to `GD3`. One map can be on two lists (SL1 and GD1 are both arena1),
  // so a slot is known by its key.
  key: string
  mode: TeamVariantKey
  map: string
  number: number
}

// One slot for each board of every team type's list, so a season rotation in
// the registry updates them by itself.
const SLOTS: readonly ArenaMapSlot[] = Object.values(TEAM_VARIANTS).flatMap((variant) =>
  variant.maps.map((map, index) => ({
    key: `${variant.key.toUpperCase()}${index + 1}`,
    mode: variant.key,
    map,
    number: index + 1,
  })),
)

export function useArenaPick() {
  const grids = useGrids()
  const { clearTargetHex } = useSelectionState()

  // A slot picked: the board moves onto its map with everything on it. A tile
  // tapped before may be another side's on the new map, or hold a unit.
  const pick = (mode: TeamVariantKey, map: string): void => {
    const board = grids.active
    if (!board || !grids.moveToMap(board, map)) return
    clearTargetHex()
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

/* The slots and the one picked, for the Arena's two map controls: the strip of
 * buttons and the tab row's menu. */
export function useArenaMapSlots() {
  const grids = useGrids()
  const { pick } = useArenaPick()

  // A slot stays picked while the board stays on its map; a board on a plain
  // map (a Maps tab pick, an edited map, a link) holds none.
  const held = computed(() => {
    const picked = grids.arenaPick
    if (!picked || grids.active?.currentMap !== picked.map) return undefined
    return SLOTS.find((slot) => slot.mode === picked.mode && slot.map === picked.map)
  })

  const select = (key: string): void => {
    const slot = SLOTS.find((entry) => entry.key === key)
    if (slot) pick(slot.mode, slot.map)
  }

  return { slots: SLOTS, held, select }
}
