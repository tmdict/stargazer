import { State } from '../types/state'

export const ARENA_5 = {
  id: 5,
  name: 'Arena V',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 5, 8, 10, 11, 14, 16, 18, 21] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [25, 28, 30, 32, 35, 35, 38, 41, 43, 44, 45],
    },
    { type: State.BLOCKED, hex: [12, 13, 19, 20, 26, 27, 33, 34] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}
