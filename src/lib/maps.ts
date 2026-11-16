/* The arena map registry. teams/wire.ts reads map ids from here for the binary
   link codec, and the generator's fit check reads the maps' tiles from here, so
   this file loads only the map JSON and stays free of the mode lists
   (mapModeLists.ts), dataLoader and Vue. */

import { fileStem } from '@/utils/fileStem'
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

function loadArenas(): Record<string, ArenaJson> {
  const modules = import.meta.glob<ArenaJson>('@/data/arena/*.json', {
    eager: true,
    import: 'default',
  })
  const arenas: Record<string, ArenaJson> = Object.fromEntries(
    Object.entries(modules)
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([path, json]) => [fileStem(path), json]),
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

// A preset's tiles as the serializer writes a board standing on it.
export const mapTileRows = (key: string): number[][] =>
  (MAPS[key]?.grid ?? [])
    .flatMap(({ type, hex }) => hex.map((id) => [id, type]))
    .sort(([a], [b]) => a! - b!)

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
