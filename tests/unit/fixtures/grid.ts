/**
 * Shared grid presets and arena layouts for unit tests.
 *
 * Three presets (SMALL_GRID 5 hexes, STANDARD_GRID 7 hexes, TARGETING_GRID
 * 14 hexes) paired with arenas covering the placement permutations used by
 * the test suites.
 */

import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'

/** 5-hex grid: rows of 1, 2, 2 */
export const SMALL_GRID: GridPreset = {
  hex: [[3], [2, 4], [1, 5]],
  qOffset: [0, -1, -1],
}

/** 7-hex grid: rows of 1, 2, 2, 2 */
export const STANDARD_GRID: GridPreset = {
  hex: [[3], [2, 4], [1, 5], [6, 7]],
  qOffset: [0, -1, -1, -2],
}

/** 14-hex grid for targeting tests: a tall column of 1-2 hex rows */
export const TARGETING_GRID: GridPreset = {
  hex: [[7], [6, 8], [5, 9], [4, 10], [3, 11], [2, 12], [1, 13, 14]],
  qOffset: [0, -1, -1, -2, -2, -3, -3],
}

/** Used with TARGETING_GRID. Ally [1-6], Enemy [9-14], Default [7,8]. */
export const TARGETING_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 5, 6] },
    { type: State.AVAILABLE_ENEMY, hex: [9, 10, 11, 12, 13, 14] },
    { type: State.DEFAULT, hex: [7, 8] },
  ],
}

/** Used with SMALL_GRID. Ally [1,2], Enemy [3,4], Blocked [5]. */
export const SMALL_BLOCKED_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2] },
    { type: State.AVAILABLE_ENEMY, hex: [3, 4] },
    { type: State.BLOCKED, hex: [5] },
  ],
}

/** Used with SMALL_GRID. Ally [1,2], Enemy [4,5], Default [3]. */
export const SMALL_OPEN_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2] },
    { type: State.AVAILABLE_ENEMY, hex: [4, 5] },
    { type: State.DEFAULT, hex: [3] },
  ],
}

/** Used with STANDARD_GRID. Ally [1,2,3], Enemy [4,5], Blocked [6], Default [7]. */
export const STANDARD_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3] },
    { type: State.AVAILABLE_ENEMY, hex: [4, 5] },
    { type: State.BLOCKED, hex: [6] },
    { type: State.DEFAULT, hex: [7] },
  ],
}

/** Used with STANDARD_GRID. Ally [1,2,3], Enemy [5,6,7], Default [4]. */
export const COMPANION_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3] },
    { type: State.AVAILABLE_ENEMY, hex: [5, 6, 7] },
    { type: State.DEFAULT, hex: [4] },
  ],
}
