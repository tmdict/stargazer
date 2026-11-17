// Honor Duel's maps, I to V in the mode's order, with their buffs. The list is
// a file of its own: the mode map lists file is also read outside this app.

import duelMaps from '@/data/hd/maps.json'
import { checkModeBoards, type TileBuff } from '@/lib/mapModeLists'
import { MAPS } from '@/lib/maps'

const DUEL_BOARDS = checkModeBoards('Honor Duel', duelMaps)

const DUEL_MAPS: readonly string[] = DUEL_BOARDS.map((board) => board.map)

// Each map with the numeral it goes by.
export const DUEL_MAP_NAMES: readonly { key: string; name: string }[] = DUEL_MAPS.map((key) => ({
  key,
  name: MAPS[key]!.name,
}))

export const DEFAULT_DUEL_MAP = DUEL_MAPS[0]!

export const isDuelMap = (mapKey: string): boolean => DUEL_MAPS.includes(mapKey)

export const duelBuffs = (mapKey: string): readonly TileBuff[] =>
  DUEL_BOARDS.find((board) => board.map === mapKey)?.buffs ?? []
