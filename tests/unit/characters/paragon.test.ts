import { describe, expect, it } from 'vitest'

import {
  PARAGON_MAX_LEVEL,
  PARAGON_STEP,
  paragonStatValue,
  teamPowerNet,
  teamPowerTotal,
} from '@/lib/characters/paragon'

describe('paragon', () => {
  it('grants PARAGON_STEP points per level', () => {
    expect(paragonStatValue(0)).toBe(0)
    expect(paragonStatValue(1)).toBe(PARAGON_STEP)
    expect(paragonStatValue(PARAGON_MAX_LEVEL)).toBe(PARAGON_MAX_LEVEL * PARAGON_STEP)
  })

  it('totals a team by summing each hero level', () => {
    expect(teamPowerTotal([])).toBe(0)
    expect(teamPowerTotal([0, 0])).toBe(0)
    expect(teamPowerTotal([1, 2, 4])).toBe((1 + 2 + 4) * PARAGON_STEP)
  })

  it('nets one team against the other as mirror opposites', () => {
    expect(teamPowerNet([2, 1], [1])).toBe((3 - 1) * PARAGON_STEP)
    expect(teamPowerNet([], [])).toBe(0)
    expect(teamPowerNet([4, 2], [1, 1])).toBe(-teamPowerNet([1, 1], [4, 2]))
  })
})
