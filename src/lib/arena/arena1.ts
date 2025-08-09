import { State } from '../types/state'

export const ARENA_1 = {
  id: 1,
  name: 'Arena I',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [30, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
    },
    { type: State.BLOCKED, hex: [] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}
