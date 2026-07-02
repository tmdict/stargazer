import { describe, expect, it } from 'vitest'

import {
  PARAGON_MAX_LEVEL,
  paragonStatValue,
  teamPowerNet,
  teamPowerTotal,
  type ParagonHero,
} from '@/lib/characters/paragon'

const hero = (level: number, faction?: string): ParagonHero => ({ level, faction })

describe('paragon', () => {
  it('ramps base factions from 0 in 4.5 steps', () => {
    expect(paragonStatValue(0, 'lightbearer')).toBe(0)
    expect(paragonStatValue(1, 'wilder')).toBe(4.5)
    expect(paragonStatValue(2, 'mauler')).toBe(9)
    expect(paragonStatValue(3, 'graveborn')).toBe(13.5)
    expect(paragonStatValue(PARAGON_MAX_LEVEL, 'lightbearer')).toBe(18)
  })

  it('ramps celestials and hypogeans from 4 in 3.5 steps', () => {
    expect(paragonStatValue(0, 'celestial')).toBe(4)
    expect(paragonStatValue(1, 'hypogean')).toBe(7.5)
    expect(paragonStatValue(2, 'celestial')).toBe(11)
    expect(paragonStatValue(3, 'hypogean')).toBe(14.5)
    expect(paragonStatValue(PARAGON_MAX_LEVEL, 'celestial')).toBe(18)
  })

  it('treats an unknown faction as a base-faction ramp', () => {
    expect(paragonStatValue(2)).toBe(9)
    expect(paragonStatValue(2, 'dimensional')).toBe(9)
  })

  it('totals a team by summing each hero value', () => {
    expect(teamPowerTotal([])).toBe(0)
    expect(teamPowerTotal([hero(0, 'wilder'), hero(0, 'mauler')])).toBe(0)
    expect(teamPowerTotal([hero(0, 'celestial'), hero(0, 'wilder')])).toBe(4)
    expect(teamPowerTotal([hero(1, 'wilder'), hero(2, 'hypogean')])).toBe(4.5 + 11)
  })

  it('nets one team against the other as mirror opposites', () => {
    expect(teamPowerNet([hero(2, 'wilder')], [hero(1, 'celestial')])).toBe(9 - 7.5)
    expect(teamPowerNet([], [])).toBe(0)
    const ally = [hero(4, 'celestial'), hero(2, 'mauler')]
    const enemy = [hero(1, 'wilder'), hero(1, 'hypogean')]
    expect(teamPowerNet(ally, enemy)).toBe(-teamPowerNet(enemy, ally))
  })
})
