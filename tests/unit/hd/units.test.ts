import { describe, expect, it } from 'vitest'

import { toTrialId, trialPickOf } from '@/lib/characters/trial'
import { loadCharacters, loadCreatures } from '@/lib/dataLoader'
import { duelTrialGroups, duelTrialHeroes } from '@/lib/hd/heroes'
import { duelTiersOf } from '@/lib/hd/units'

// A hero of the shop, a Supreme Trial Card's hero and a creature.
const SHOP_HERO = 11
const SUPREME_HERO = 6
const CREATURE = 7001

describe("the tiers a unit's source allows", () => {
  it('a shop hero holds Epic to Mythic, and its Trial copy the tiers of the cards that show it', () => {
    expect(duelTiersOf(SHOP_HERO)).toEqual([0, 1, 2])
    expect(duelTiersOf(toTrialId(SHOP_HERO, 4))).toEqual([0, 1, 2])
  })

  it("a card's own unit holds the card's tier, as a Trial unit alone", () => {
    expect(duelTiersOf(toTrialId(SUPREME_HERO, 1))).toEqual([3])
    expect(duelTiersOf(SUPREME_HERO)).toEqual([])
    expect(duelTiersOf(toTrialId(CREATURE, 1))).toEqual([0])
    expect(duelTiersOf(CREATURE)).toEqual([])
  })
})

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
