/* The mode map lists: each mode's boards with their buffs, and the preset a
   board's tiles stand on, which the lists choose between presets that share a
   layout. */

import modeMapLists from '@/data/maps.json'
import { fileStem } from '@/utils/fileStem'
import type { Grid } from './grid'
import {
  availableState,
  configTiles,
  DEFAULT_MAP_KEY,
  MAPS,
  presetLayout,
  type MapLayout,
} from './maps'
import { State } from './types/state'
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
function loadModeLists(): Record<ModeListKey, readonly ModeBoard[]> {
  const lists: Record<ModeListKey, readonly ModeBoard[]> = modeMapLists
  for (const [mode, boards] of Object.entries(lists)) {
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
            throw new Error(
              `Mode ${mode}, map ${map}: buff tile ${hex} is not an ally or enemy tile`,
            )
          }
          if (buffed.has(hex)) {
            throw new Error(`Mode ${mode}, map ${map}: tile ${hex} has two buffs`)
          }
          buffed.add(hex)
        }
      }
    }
  }
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

// Occupied tiles read as available, so a populated board still matches its preset.
const tileKey = (hexId: number, state: State): string => `${hexId}:${availableState(state)}`

const layoutKey = (tileKeys: string[]): string => tileKeys.sort().join(' ')

const onTeamList = new Set(
  Object.values(MODE_BOARDS)
    .flat()
    .map((board) => board.map),
)

const LAYOUTS = Object.entries(MAPS)
  .map(([key, config]) => ({
    key,
    layout: layoutKey(config.grid.flatMap(({ type, hex }) => hex.map((id) => tileKey(id, type)))),
  }))
  .sort((a, b) => Number(onTeamList.has(b.key)) - Number(onTeamList.has(a.key)))

// The preset whose layout the serialized `[hexId, state]` tiles (non-default
// only, as the serializer emits them) reproduce exactly, if any. Presets that
// share a layout (a season's preset reusing a permanent arena) are the same
// board, and the one on a team type's map list stands for both, since the
// Arena's slot and links carry no map key and its quick-select names that one.
export const findMapByTiles = (tiles: readonly number[][]): string | undefined => {
  const layout = layoutKey(
    tiles.flatMap(([hexId, state]) =>
      hexId === undefined || state === undefined ? [] : [tileKey(hexId, state)],
    ),
  )
  return LAYOUTS.find((preset) => preset.layout === layout)?.key
}

// A preset as a board of a mode stands on it, with the buff tiles it has on
// that mode's list.
export const modeLayout = (mode: ModeListKey, key: string): MapLayout | undefined =>
  presetLayout(key, buffTilesOf(modeBuffs(mode, key)))

// The layout serialized `[hexId, state]` tiles stand on, with a preset's buff
// tiles. A Map Editor map has none, since the editor cannot place them.
export const tilesLayout = (
  tiles: readonly number[][],
  buffTiles: readonly number[] = [],
): MapLayout => {
  const preset = findMapByTiles(tiles)
  if (preset) return presetLayout(preset, buffTiles)!
  const byState = new Map<State, number[]>()
  for (const [hexId, state] of tiles) {
    if (hexId === undefined || state === undefined) continue
    const type = availableState(state)
    byState.set(type, [...(byState.get(type) ?? []), hexId])
  }
  const grid = [...byState]
    .sort(([a], [b]) => a - b)
    .map(([type, hex]) => ({ type, hex: hex.sort((a, b) => a - b) }))
  const key = layoutKey(grid.flatMap(({ type, hex }) => hex.map((id) => tileKey(id, type))))
  return { key: `edited:${key}`, config: { id: 0, name: '', grid }, buffTiles: [] }
}

// The layout a live board's tiles stand on.
export const gridLayout = (
  grid: Pick<Grid, 'getAllTiles'>,
  buffTiles: readonly number[] = [],
): MapLayout =>
  tilesLayout(
    grid
      .getAllTiles()
      .flatMap((tile) => (tile.state === State.DEFAULT ? [] : [[tile.hex.getId(), tile.state]])),
    buffTiles,
  )

/* The map a serialized board stands on: its key when that names a map, else
 * the preset its tiles reproduce, else its key or the default map, so a board
 * saved on a map the registry lacks is named by a preset with the same tiles.
 * The one rule shared by canonicalization (which fills `m` through it) and the
 * multi-board restore, so a saved record and the live boards it loads into
 * always name the same maps. */
export const resolveBoardMap = (board: { m?: string; t?: number[][] }): string =>
  board.m !== undefined && MAPS[board.m]
    ? board.m
    : (findMapByTiles(board.t ?? []) ?? board.m ?? DEFAULT_MAP_KEY)
