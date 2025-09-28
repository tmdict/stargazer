import { State } from '../types/state'

export const ARENA_5_SP_S4 = {
  id: 7,
  name: 'SP (S4)',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 6, 8] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [10, 14, 35, 38, 40, 42, 43, 44, 45],
    },
    { type: State.BLOCKED, hex: [7, 13, 17] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}
