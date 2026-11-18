import { describe, expect, it } from 'vitest'

import { toTrialId, trialPickOf } from '@/lib/characters/trial'
import { loadCharacters, loadCreatures } from '@/lib/dataLoader'
import { duelTrialGroups, duelTrialPool } from '@/lib/hd/heroes'
import { duelTiersOf } from '@/lib/hd/units'

// A hero of the shop, a Supreme Trial Card's hero and a creature.
const SHOP_HERO = 11
const SUPREME_HERO = 6
const CREATURE = 7001

describe("the tiers a unit's source allows", () => {
  it('a shop hero holds Epic to Mythic, and its Trial copy the tiers of the cards that show it', () => {
    expect(duelTiersOf(SHOP_HERO)).toEqual([0, 1, 2])
    expect(duelTiersOf(toTrialId(SHOP_HERO, 4))).toEqual([1, 2])
  })

  it("a card's own unit holds the card's tier, as a Trial unit alone", () => {
    expect(duelTiersOf(toTrialId(SUPREME_HERO, 1))).toEqual([3])
    expect(duelTiersOf(SUPREME_HERO)).toEqual([])
    expect(duelTiersOf(toTrialId(CREATURE, 1))).toEqual([0])
    expect(duelTiersOf(CREATURE)).toEqual([])
  })
})

describe("the Trial list's groups", () => {
  const unitOf = (id: number) =>
    [...loadCharacters(), ...loadCreatures()].find((unit) => unit.id === id)!
  const picks = (units: readonly { id: number }[]) => units.map((unit) => trialPickOf(unit.id))

  it("lists each card's units under picks that carry its tier, and leaves out a card with none", () => {
    const groups = duelTrialGroups([unitOf(SHOP_HERO), unitOf(SUPREME_HERO)])

    expect(groups.map((group) => picks(group.units))).toEqual([
      [{ baseId: SHOP_HERO, tier: 1 }],
      [{ baseId: SHOP_HERO, tier: 2 }],
      [{ baseId: SUPREME_HERO, tier: 3 }],
    ])
    expect(picks(duelTrialPool(groups))).toEqual([
      { baseId: SHOP_HERO, tier: 1 },
      { baseId: SUPREME_HERO, tier: 3 },
    ])
  })

  it('puts the creatures in the first group', () => {
    const [first] = duelTrialGroups([unitOf(SHOP_HERO), unitOf(CREATURE)])

    expect(picks(first!.units)).toEqual([{ baseId: CREATURE, tier: 0 }])
  })
})
