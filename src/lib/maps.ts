/* The arena map registry and the mode map lists. teams/wire.ts reads map ids
   from here for the binary link codec, so this file loads only the map JSON,
   the mode lists and the buff text they name, and stays free of dataLoader and
   Vue. */

import modeMapLists from '@/data/maps.json'
import type { Grid } from './grid'
import { State } from './types/state'
import { Team } from './types/team'

interface ArenaJson {
  // Carried by links (a 6-bit field, 0 meaning "no map"), so it never changes
  // while the map exists; a retired preset's id returns to the pool.
  id: number
  name: string
  grid: {
    ally: number[]
    enemy: number[]
    blocked: number[]
    breakable: number[]
  }
}

export interface MapConfig {
  id: number
  name: string
  grid: Array<{
    type: State
    hex: number[]
  }>
}

const STATE_MAP: Record<keyof ArenaJson['grid'], State> = {
  ally: State.AVAILABLE_ALLY,
  enemy: State.AVAILABLE_ENEMY,
  blocked: State.BLOCKED,
  breakable: State.BLOCKED_BREAKABLE,
}

function parseMapConfig(json: ArenaJson): MapConfig {
  return {
    id: json.id,
    name: json.name,
    grid: Object.entries(json.grid).map(([key, hex]) => ({
      type: STATE_MAP[key as keyof ArenaJson['grid']],
      hex,
    })),
  }
}

const fileKey = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '')

function loadArenas(): Record<string, ArenaJson> {
  const modules = import.meta.glob<ArenaJson>('@/data/arena/*.json', {
    eager: true,
    import: 'default',
  })
  const arenas: Record<string, ArenaJson> = Object.fromEntries(
    Object.entries(modules)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([path, json]) => [fileKey(path), json]),
  )
  // A new preset usually starts as a copy of another file, and two maps on one
  // id would send that id's links to whichever loaded last.
  const owners = new Map<number, string>()
  for (const [key, { id }] of Object.entries(arenas)) {
    if (!Number.isInteger(id) || id < 1) {
      throw new Error(`Map ${key}: id must be a positive integer`)
    }
    const owner = owners.get(id)
    if (owner) throw new Error(`Map ${key}: id ${id} already belongs to ${owner}`)
    owners.set(id, key)
  }
  return arenas
}

const ARENAS = loadArenas()

// ---- Mode map lists ----

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
  Object.keys(import.meta.glob('@/locales/buff/*.json', { eager: true })).map(fileKey),
)

/* A board is found by its mode and map alone (the Arena's dropdown pick keeps
 * no board number), so a map is on a mode's list at most once. A buff sits on
 * deployment tiles, where a hero can stand, and a tile holds one buff. */
function loadModeLists(): Record<ModeListKey, readonly ModeBoard[]> {
  const lists: Record<ModeListKey, readonly ModeBoard[]> = modeMapLists
  for (const [mode, boards] of Object.entries(lists)) {
    const listed = new Set<string>()
    for (const { map, buffs = [] } of boards) {
      const grid = ARENAS[map]?.grid
      if (!grid) throw new Error(`Mode ${mode}: no map ${map}`)
      if (listed.has(map)) throw new Error(`Mode ${mode}: map ${map} is listed twice`)
      listed.add(map)
      const buffed = new Set<number>()
      for (const { id, tiles } of buffs) {
        if (!BUFF_TEXTS.has(id)) throw new Error(`Mode ${mode}, map ${map}: no text for buff ${id}`)
        if (!tiles.length) throw new Error(`Mode ${mode}, map ${map}: buff ${id} has no tiles`)
        for (const hex of tiles) {
          if (!grid.ally.includes(hex) && !grid.enemy.includes(hex)) {
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

// Keyed by filename under src/data/arena/; the key is what `m` sections and
// TEAM_MODES default lists reference.
export const MAPS: Record<string, MapConfig> = Object.fromEntries(
  Object.entries(ARENAS).map(([key, json]) => [key, parseMapConfig(json)]),
)

// The map a board stands on when nothing names one: fresh contexts, mode
// default lists, and boards restored without a resolvable key.
export const DEFAULT_MAP_KEY = 'arena1'

export const DEFAULT_MAP = MAPS[DEFAULT_MAP_KEY]!

export const getMapNames = (): Array<{ key: string; name: string }> => {
  return Object.entries(MAPS).map(([key, config]) => ({
    key,
    name: config.name,
  }))
}

export const getMapByKey = (key: string): MapConfig | undefined => {
  return MAPS[key]
}

// A side's deployment tiles on a map's layout.
export const configTiles = (config: Pick<MapConfig, 'grid'>, team: Team): Set<number> => {
  const state = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
  return new Set(config.grid.filter((g) => g.type === state).flatMap((g) => g.hex))
}

export const deploymentTiles = (mapKey: string, team: Team): Set<number> =>
  configTiles(MAPS[mapKey] ?? { grid: [] }, team)

const AVAILABLE_STATE: Partial<Record<State, State>> = {
  [State.OCCUPIED_ALLY]: State.AVAILABLE_ALLY,
  [State.OCCUPIED_ENEMY]: State.AVAILABLE_ENEMY,
}

// A tile's state without its occupant.
export const availableState = (state: State): State => AVAILABLE_STATE[state] ?? state

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

// A board's tiles and buff tiles as the placement engine plans on them, under
// the key it reads its seed, its cached fits and the enemies' pick rates by: a
// preset's own key, or `edited:` and the layout for tiles no preset has. A
// board's buff tiles come from the mode whose list it stands on, never from
// the map alone.
export interface MapLayout {
  key: string
  config: MapConfig
  buffTiles: readonly number[]
}

export const presetLayout = (
  key: string,
  buffTiles: readonly number[] = [],
): MapLayout | undefined => {
  const config = MAPS[key]
  return config && { key, config, buffTiles }
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

/* The map a serialized board stands on: its key when present, else the preset
 * its tiles reproduce, else the default map. The one rule shared by
 * canonicalization (which fills `m` through it) and the multi-board restore,
 * so a saved record and the live boards it loads into always name the same
 * maps. */
export const resolveBoardMap = (board: { m?: string; t?: number[][] }): string =>
  board.m ?? findMapByTiles(board.t ?? []) ?? DEFAULT_MAP_KEY
