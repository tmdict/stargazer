import { State } from '../types/state'

export const ARENA_5_SP_S5 = {
  id: 8,
  name: 'SP (S5)',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 21, 28] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [18, 25, 30, 37, 38, 39, 40, 41, 42, 43, 44, 45],
    },
    { type: State.BLOCKED, hex: [14, 17, 22, 24, 29, 32] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}
