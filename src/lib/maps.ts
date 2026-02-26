import { loadArenas, type ArenaJson } from '@/utils/dataLoader'
import { State } from './types/state'

export interface MapConfig {
  name: string
  grid: Array<{
    type: State
    hex: number[]
  }>
}

// Maps JSON grid keys to hex tile states
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

// Auto-discovered from src/data/arena/*.json, keyed by filename
export const MAPS: Record<string, MapConfig> = Object.fromEntries(
  Object.entries(loadArenas()).map(([key, json]) => [key, parseMapConfig(json)]),
)

export const DEFAULT_MAP = MAPS['arena1']!

export const getMapNames = (): Array<{ key: string; name: string }> => {
  return Object.entries(MAPS).map(([key, config]) => ({
    key,
    name: config.name,
  }))
}

export const getMapByKey = (key: string): MapConfig | undefined => {
  return MAPS[key]
}
