import { State } from '../types/state'

export const ARENA_4 = {
  id: 4,
  name: 'Arena IV',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 3, 4, 6, 8, 9, 21, 24, 28] },
    {
      type: State.AVAILABLE_ENEMY,
      hex: [18, 22, 25, 37, 38, 40, 42, 43, 45],
    },
    { type: State.BLOCKED, hex: [] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}
