/* The arena map registry. teams/wire.ts reads map ids from here for the
   binary link codec, so this file loads only the arena JSON and stays free of
   dataLoader and Vue. */

import { State } from './types/state'

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

// Keyed by filename under src/data/arena/; the key is what `m` sections and
// TEAM_MODES default lists reference.
export const MAPS: Record<string, MapConfig> = Object.fromEntries(
  Object.entries(loadArenas()).map(([key, json]) => [key, parseMapConfig(json)]),
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

// Occupied tiles read as their available state, so a populated board still
// matches its preset.
const AVAILABLE_STATE: Partial<Record<State, State>> = {
  [State.OCCUPIED_ALLY]: State.AVAILABLE_ALLY,
  [State.OCCUPIED_ENEMY]: State.AVAILABLE_ENEMY,
}

const tileKey = (hexId: number, state: State): string =>
  `${hexId}:${AVAILABLE_STATE[state] ?? state}`

const layoutKey = (tileKeys: string[]): string => tileKeys.sort().join(' ')

const LAYOUTS = Object.entries(MAPS).map(([key, config]) => ({
  key,
  layout: layoutKey(config.grid.flatMap(({ type, hex }) => hex.map((id) => tileKey(id, type)))),
}))

// The preset whose layout the serialized `[hexId, state]` tiles (non-default
// only, as the serializer emits them) reproduce exactly, if any. Presets that
// share a layout (a season's preset reusing a permanent arena) are the same
// board, and the first registered stands for both.
export const findMapByTiles = (tiles: readonly number[][]): string | undefined => {
  const layout = layoutKey(
    tiles.flatMap(([hexId, state]) =>
      hexId === undefined || state === undefined ? [] : [tileKey(hexId, state)],
    ),
  )
  return LAYOUTS.find((preset) => preset.layout === layout)?.key
}

/* The map a serialized board stands on: its key when present, else the preset
 * its tiles reproduce, else the default map. The one rule shared by
 * canonicalization (which fills `m` through it) and the multi-board restore,
 * so a saved record and the live boards it loads into always name the same
 * maps. */
export const resolveBoardMap = (board: { m?: string; t?: number[][] }): string =>
  board.m ?? findMapByTiles(board.t ?? []) ?? DEFAULT_MAP_KEY
