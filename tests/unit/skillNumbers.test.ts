import { describe, expect, it } from 'vitest'

import {
  heroSkillNumbers,
  skillNumbers,
  type FeedHeroNumbers,
  type FeedLevelNumbers,
} from '../../scripts/lib/skillNumbers'

const level = (overrides: Partial<FeedLevelNumbers> = {}, n = 1): FeedLevelNumbers => ({
  level: n,
  cd: 9999,
  initCd: 9999,
  range: null,
  ...overrides,
})

const levels = (overrides: Partial<FeedLevelNumbers>, count = 4) =>
  Array.from({ length: count }, (_, i) => level(overrides, i + 1))

const hero = (skills: FeedHeroNumbers['skills']): FeedHeroNumbers => ({ skills })

const numbersOf = (skills: FeedHeroNumbers['skills']) => heroSkillNumbers('x', hero(skills)).numbers

describe('heroSkillNumbers', () => {
  it('shows cooldown, initial cooldown and range', () => {
    expect(numbersOf({ skill2: levels({ cd: 7, initCd: 1, range: 1 }) })).toEqual({
      skill2: { cooldown: 7, initialCooldown: 1, range: 1 },
    })
  })

  it('shows a zero cooldown: the skill is instant', () => {
    expect(numbersOf({ ultimate: levels({ cd: 0, initCd: 0, range: 10 }, 5) })).toEqual({
      ultimate: { cooldown: 0, initialCooldown: 0, range: 10 },
    })
  })

  it("hides only the game's no-timer values", () => {
    expect(
      numbersOf({
        skill2: levels({ cd: 999999, initCd: 9999990, range: 3 }),
        skill3: levels({ cd: 15, initCd: 9999 }),
        ex: levels({ cd: 65, initCd: 90 }),
      }),
    ).toEqual({
      skill2: { range: 3 },
      skill3: { cooldown: 15 },
      ex: { cooldown: 65, initialCooldown: 90 },
    })
  })

  it('reads 15 tiles and more as a global range', () => {
    expect(numbersOf({ skill2: levels({ range: 15 }), skill3: levels({ range: 14 }) })).toEqual({
      skill2: { range: 'global' },
      skill3: { range: 14 },
    })
  })

  it('covers mastery, EX and awakening', () => {
    expect(
      numbersOf({
        mastery: levels({ range: 1 }, 3),
        ex: levels({ cd: 12, initCd: 12, range: 20 }),
        awakening: levels({ cd: 0, initCd: 0 }, 2),
      }),
    ).toEqual({
      mastery: { range: 1 },
      ex: { cooldown: 12, initialCooldown: 12, range: 'global' },
      awakening: { cooldown: 0, initialCooldown: 0 },
    })
  })

  it('keeps Lv1 values and records only what a later level changes', () => {
    const ex = [
      level({ cd: 15, initCd: 15, range: 20 }, 1),
      level({ cd: 15, initCd: 15, range: 20 }, 2),
      level({ cd: 12, initCd: 12, range: 20 }, 3),
      level({ cd: 12, initCd: 12, range: 20 }, 4),
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
    const skill2 = [level({ cd: 5, initCd: 0 }, 1), level({ cd: 9999, initCd: 0 }, 2)]
    const { numbers, problems } = heroSkillNumbers('x', hero({ skill2 }))
    expect(numbers).toEqual({ skill2: { cooldown: 5, initialCooldown: 0 } })
    expect(problems).toEqual([
      'x/skill2: cooldown disappears at Lv 2',
      'x/skill2: initialCooldown disappears at Lv 2',
    ])
  })
})

describe('skillNumbers', () => {
  it('writes heroes in slug order, skipping those with nothing to show', () => {
    const heroes = {
      zanie: hero({ skill2: levels({ cd: 12, initCd: 2 }) }),
      aliceth: hero({ ultimate: levels({ cd: 0, initCd: 0 }, 5) }),
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
