import { ARENA_1 } from './arena/arena1'
import { ARENA_2 } from './arena/arena2'
import { ARENA_3 } from './arena/arena3'
import { ARENA_4 } from './arena/arena4'
import { ARENA_5 } from './arena/arena5'
import { ARENA_5_SP_S3 } from './arena/arena5sps3'
import { ARENA_5_SP_S4 } from './arena/arena5sps4'
import { ARENA_5_SP_S5 } from './arena/arena5sps5'
import { State } from './types/state'

export interface MapConfig {
  id: number
  name: string
  grid: Array<{
    type: State
    hex: number[]
  }>
}

export const MAPS: Record<string, MapConfig> = {
  arena1: ARENA_1,
  arena2: ARENA_2,
  arena3: ARENA_3,
  arena4: ARENA_4,
  arena5: ARENA_5,
  arena6: ARENA_5_SP_S5,
  arena7: ARENA_5_SP_S3,
  arena8: ARENA_5_SP_S4,
}

export const getMapNames = (): Array<{ key: string; name: string }> => {
  return Object.entries(MAPS).map(([key, config]) => ({
    key,
    name: config.name,
  }))
}

export const getMapByKey = (key: string): MapConfig | undefined => {
  return MAPS[key]
}
