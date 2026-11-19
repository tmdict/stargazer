import { describe, expect, it } from 'vitest'

import { trialPickOf } from '@/lib/characters/trial'
import { loadCharacters, loadCreatures } from '@/lib/dataLoader'
import { duelTrialGroups, duelTrialHeroes } from '@/lib/hd/heroes'

// A hero of the shop, a Supreme Trial Card's hero and a creature.
const SHOP_HERO = 11
const SUPREME_HERO = 6
const CREATURE = 7001

describe("the pickers' Trial units", () => {
  const unitOf = (id: number) =>
    [...loadCharacters(), ...loadCreatures()].find((unit) => unit.id === id)!
  const picks = (units: readonly { id: number }[]) => units.map((unit) => trialPickOf(unit.id))

  it('lists a shop hero once, as a pick at the lowest tier a card brings it at', () => {
    const heroes = duelTrialHeroes([unitOf(SHOP_HERO), unitOf(SUPREME_HERO)])

    expect(picks(heroes)).toEqual([{ baseId: SHOP_HERO, tier: 0 }])
  })

  it("groups the units a card names under picks that carry its tier, heroes before creatures, without the shop's heroes", () => {
    const groups = duelTrialGroups([unitOf(SHOP_HERO), unitOf(SUPREME_HERO), unitOf(CREATURE)])

    expect(groups.map((group) => picks(group.units))).toEqual([
      [{ baseId: SUPREME_HERO, tier: 3 }],
      [{ baseId: CREATURE, tier: 0 }],
    ])
  })
})
