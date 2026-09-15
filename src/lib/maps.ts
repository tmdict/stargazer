import { loadArenas, type ArenaJson } from '@/utils/dataLoader'
import { State } from './types/state'

export interface MapConfig {
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
    name: json.name,
    grid: Object.entries(json.grid).map(([key, hex]) => ({
      type: STATE_MAP[key as keyof ArenaJson['grid']],
      hex,
    })),
  }
}

// Keyed by filename under src/data/arena/; the key is what `m` sections and
// TEAM_MODES default lists reference.
export const MAPS: Record<string, MapConfig> = Object.fromEntries(
  Object.entries(loadArenas()).map(([key, json]) => [key, parseMapConfig(json)]),
)

export const DEFAULT_MAP = MAPS['arena1']!

// Per-board starting arenas for the 5v5 SL team mode, by board index. Keys index
// src/data/arena/*.json; its length is the board count. Editing this list changes
// the mode's persisted defaults fingerprint, which hard-resets every visitor's
// active 5v5 SL boards on next load (saved teams keep their own maps).
export const FIVE_V_FIVE_DEFAULT_MAPS = [
  'arena1',
  'arena2',
  'preset-sr2',
  'preset-sr3',
  'preset-sr1',
]

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
