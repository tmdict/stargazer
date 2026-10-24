import { describe, expect, it } from 'vitest'

import {
  energyMismatches,
  skillNumbers,
  type FeedHeroNumbers,
  type FeedLevelNumbers,
} from '../../scripts/lib/skillNumbers'

const level = (values: Omit<FeedLevelNumbers, 'level'> = {}, n = 1): FeedLevelNumbers => ({
  level: n,
  ...values,
})

const levels = (values: Omit<FeedLevelNumbers, 'level'>, count = 4) =>
  Array.from({ length: count }, (_, i) => level(values, i + 1))

const hero = (skills: FeedHeroNumbers['skills'], initialEnergy = 0): FeedHeroNumbers => ({
  initialEnergy,
  skills,
})

const numbersOf = (skills: FeedHeroNumbers['skills']) =>
  skillNumbers({ x: hero(skills) }, ['x']).numbers.x

describe("a hero's slots", () => {
  it('covers mastery, EX and awakening', () => {
    expect(
      numbersOf({
        mastery: levels({ range: 1 }, 3),
        ex: levels({ cooldown: 12, initialCooldown: 12, range: 'global' }),
        awakening: levels({ cooldown: 0, initialCooldown: 0 }, 2),
      }),
    ).toEqual({
      mastery: { range: 1 },
      ex: { cooldown: 12, initialCooldown: 12, range: 'global' },
      awakening: { cooldown: 0, initialCooldown: 0 },
    })
  })

  it('keeps Lv1 values and records only what a later level changes', () => {
    const ex = [
      level({ cooldown: 15, initialCooldown: 15, range: 'global' }, 1),
      level({ cooldown: 15, initialCooldown: 15, range: 'global' }, 2),
      level({ cooldown: 12, initialCooldown: 12, range: 'global' }, 3),
      level({ cooldown: 12, initialCooldown: 12, range: 'global' }, 4),
    ]
    expect(numbersOf({ ex })).toEqual({
      ex: {
        cooldown: 15,
        initialCooldown: 15,
        range: 'global',
        levels: { 3: { cooldown: 12, initialCooldown: 12 } },
      },
    })
  })

  it('reports a value a later level removes', () => {
    const skill2 = [level({ cooldown: 5, initialCooldown: 0 }, 1), level({}, 2)]
    const { numbers, problems } = skillNumbers({ x: hero({ skill2 }) }, ['x'])
    expect(numbers.x).toEqual({ skill2: { cooldown: 5, initialCooldown: 0 } })
    expect(problems).toEqual([
      'x/skill2: cooldown disappears at Lv 2',
      'x/skill2: initialCooldown disappears at Lv 2',
    ])
  })
})

describe('skillNumbers', () => {
  it('writes heroes in slug order, skipping those with nothing to show', () => {
    const heroes = {
      zanie: hero({ skill2: levels({ cooldown: 12, initialCooldown: 2 }) }),
      aliceth: hero({ ultimate: levels({ cooldown: 0, initialCooldown: 0 }, 5) }),
      passive: hero({ skill2: levels({}) }),
    }
    const { numbers, problems } = skillNumbers(heroes, ['zanie', 'passive', 'aliceth'])
    expect(Object.keys(numbers)).toEqual(['aliceth', 'zanie'])
    expect(problems).toEqual([])
  })

  it('reports a hero the numbers feed lacks', () => {
    const { numbers, problems } = skillNumbers({}, ['ghost'])
    expect(numbers).toEqual({})
    expect(problems).toEqual(["ghost: not in the feed's skill numbers"])
  })
})

describe('energyMismatches', () => {
  it("compares a hero file's own starting energy with the feed's, not what skills add", () => {
    const heroes = { lyca: hero({}, 200), cyran: hero({}, 500), odie: { skills: {} } }
    const files = [
      { slug: 'lyca', energy: [200, 300] },
      { slug: 'cyran', energy: [400, 200] },
      { slug: 'odie', energy: [300] },
      { slug: 'ghost', energy: [0] },
    ]
    expect(energyMismatches(heroes, files)).toEqual([
      'cyran: the hero file starts at 400, the feed at 500',
      'odie: the feed has no starting energy',
    ])
  })
})
