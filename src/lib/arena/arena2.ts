import { State } from '../types/state'

export const ARENA_2 = {
  id: 2,
  name: 'Arena II',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 5, 6, 7, 8, 10] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [33, 36, 38, 39, 40, 41, 42, 43, 44, 45],
    },
    { type: State.BLOCKED, hex: [9, 11, 12, 15, 18, 28, 31, 34, 35, 37] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}
