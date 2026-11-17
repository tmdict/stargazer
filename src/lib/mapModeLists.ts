/* The mode map lists: each mode's boards in order, with their buffs. */

import modeMapLists from '@/data/maps.json'
import { fileStem } from '@/utils/fileStem'
import { configTiles, MAPS, presetLayout, type MapLayout } from './maps'
import { Team } from './types/team'

// A buff on a mode's board: the tiles it sits on, and the name of its text's
// file under src/locales/buff/.
export interface TileBuff {
  id: string
  tiles: readonly number[]
}

// One board of a mode, in the order the mode plays them.
interface ModeBoard {
  map: string
  buffs?: readonly TileBuff[]
}

export type ModeListKey = keyof typeof modeMapLists

const BUFF_TEXTS = new Set(
  Object.keys(import.meta.glob('@/locales/buff/*.json', { eager: true })).map(fileStem),
)

/* A board is found by its mode and map alone (the Arena's dropdown pick keeps
 * no board number), so a map is on a mode's list at most once. A buff sits on
 * deployment tiles, where a hero can stand, and a tile holds one buff. */
export function checkModeBoards(mode: string, boards: readonly ModeBoard[]): readonly ModeBoard[] {
  const listed = new Set<string>()
  for (const { map, buffs = [] } of boards) {
    const config = MAPS[map]
    if (!config) throw new Error(`Mode ${mode}: no map ${map}`)
    const deployment = new Set([
      ...configTiles(config, Team.ALLY),
      ...configTiles(config, Team.ENEMY),
    ])
    if (listed.has(map)) throw new Error(`Mode ${mode}: map ${map} is listed twice`)
    listed.add(map)
    const buffed = new Set<number>()
    for (const { id, tiles } of buffs) {
      if (!BUFF_TEXTS.has(id)) throw new Error(`Mode ${mode}, map ${map}: no text for buff ${id}`)
      if (!tiles.length) throw new Error(`Mode ${mode}, map ${map}: buff ${id} has no tiles`)
      for (const hex of tiles) {
        if (!deployment.has(hex)) {
          throw new Error(`Mode ${mode}, map ${map}: buff tile ${hex} is not an ally or enemy tile`)
        }
        if (buffed.has(hex)) {
          throw new Error(`Mode ${mode}, map ${map}: tile ${hex} has two buffs`)
        }
        buffed.add(hex)
      }
    }
  }
  return boards
}

function loadModeLists(): Record<ModeListKey, readonly ModeBoard[]> {
  const lists: Record<ModeListKey, readonly ModeBoard[]> = modeMapLists
  for (const [mode, boards] of Object.entries(lists)) checkModeBoards(mode, boards)
  return lists
}

// Each mode's boards in board order, keyed as the Teams page's variants.
export const MODE_BOARDS = loadModeLists()

// The buffs a map carries on a mode's list; none for a map off it.
export const modeBuffs = (mode: ModeListKey, mapKey: string): readonly TileBuff[] =>
  MODE_BOARDS[mode].find((board) => board.map === mapKey)?.buffs ?? []

// Every buff's tiles together, as a layout holds them.
export const buffTilesOf = (buffs: readonly TileBuff[]): number[] =>
  buffs.flatMap((buff) => buff.tiles)

export const buffAt = (buffs: readonly TileBuff[], hexId: number): string | undefined =>
  buffs.find((buff) => buff.tiles.includes(hexId))?.id

// A preset as a board of a mode stands on it, with the buff tiles it has on
// that mode's list.
export const modeLayout = (mode: ModeListKey, key: string): MapLayout | undefined =>
  presetLayout(key, buffTilesOf(modeBuffs(mode, key)))
