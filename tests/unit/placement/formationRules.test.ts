import { describe, expect, it } from 'vitest'

import { ruleCards, ruleLists } from '@/lib/placement/formationRules'
import type { Rule } from '@/lib/types/rule'

const WEIGHTS = { aim: 10, buff: 3, threat: 20 }

const RULES: Rule[] = [
  { team: 'enemy', goal: { avoid: 'damage' }, tile: 'mirror-around', weight: 'threat', note: '' },
  {
    team: 'ally',
    goal: { target: 'damage', others: 0.5 },
    tile: 'around',
    weight: 'aim',
    note: '',
  },
  { team: 'ally', goal: { include: 'save' }, weight: 'buff', note: '' },
  { team: 'ally', goal: 'back', weight: 'aim', note: '' },
  {
    team: 'ally',
    goal: { target: 'support' },
    tile: 'behind',
    from: 'companion',
    weight: 'threat',
    note: '',
  },
]

describe('Formation rules cards', () => {
  // A rule for an enemy hero only settles ties, so its card shows no weight,
  // and its Targets line says where it lands in place of a tile.
  it('word each rule by its file and body, ours first, with only the details that apply', () => {
    expect(ruleCards('hero', 'x', RULES, WEIGHTS).cards).toEqual([
      {
        team: 'ally',
        effect: { verb: 'gives', key: 'placement-gives-x' },
        note: 'placement-note-x-ally-target',
        list: 'damage',
        use: 'first-others',
        tile: 'around',
      },
      {
        team: 'ally',
        effect: { verb: 'gives', key: 'placement-gives-x' },
        note: 'placement-note-x-ally-include',
        list: 'save',
        use: 'every',
        weight: 'less',
      },
      { team: 'ally', effect: 'back', note: 'placement-note-x-ally-back' },
      {
        team: 'ally',
        effect: { verb: 'gives', key: 'placement-gives-x-companion' },
        note: 'placement-note-x-companion-ally-target',
        list: 'support',
        use: 'first',
        tile: 'behind',
        weight: 'more',
      },
      {
        team: 'enemy',
        effect: null,
        note: 'placement-note-x-enemy-avoid',
        list: 'damage',
        use: 'avoid',
        targets: 'placement-targets-x',
      },
    ])
  })
})

describe('Formation rules lists', () => {
  const lists = {
    damage: [1, 2, { line: true as const }, 3],
    save: [4, { list: 'damage' }, { line: true as const }, { every: { class: ['tank'] } }],
    loop: [{ list: 'back' }],
    back: [6, { list: 'loop' }],
  }
  const tanks = { heroesMatching: () => [5, 1] }
  const shown = ruleLists(lists, [ruleCards('hero', 'x', RULES, WEIGHTS)], tanks)

  // Above the line a brought-in list keeps its order and its own line; a hero
  // already placed keeps that first place.
  it('group heroes by the entry that brought them in, a brought-in list keeping its line', () => {
    expect(shown.save).toEqual({
      ranked: [
        { source: null, heroes: [4] },
        { source: { list: 'damage' }, heroes: [1, 2] },
      ],
      equal: [
        { source: { list: 'damage' }, heroes: [3] },
        { source: { every: { class: ['tank'] } }, heroes: [5] },
      ],
      readers: [{ unit: 'x', enemy: false }],
      broughtInto: [],
    })
    expect(shown.damage!.readers).toEqual([
      { unit: 'x', enemy: false },
      { unit: 'x', enemy: true },
    ])
    expect(shown.damage!.broughtInto).toEqual(['save'])
  })

  it('leave out lists that bring themselves in', () => {
    expect(Object.keys(shown)).toEqual(['damage', 'save'])
  })
})
