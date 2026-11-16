/* The preset a board's tiles stand on. Presets that share a layout are told
   apart by the mode lists. */

import type { Grid } from './grid'
import { MODE_BOARDS } from './mapModeLists'
import { availableState, DEFAULT_MAP_KEY, MAPS, presetLayout, type MapLayout } from './maps'
import { State } from './types/state'

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
