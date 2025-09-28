import { State } from '../types/state'

export const ARENA_5_SP_S3 = {
  id: 6,
  name: 'SP (S3)',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 5, 7, 9, 12, 15, 18] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [28, 31, 34, 37, 39, 41, 43, 44, 45],
    },
    { type: State.BLOCKED, hex: [] },
    { type: State.BLOCKED_BREAKABLE, hex: [4, 6, 8, 11, 35, 38, 40, 42] },
  ],
}
