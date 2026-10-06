import { describe, expect, it } from 'vitest'

import {
  entryPin,
  fromTagQuery,
  matchesPick,
  openingPicks,
  pinnedLevels,
  tagVocabulary,
  toTagQuery,
} from '@/lib/tags'
import type { CharacterTags, TagPick } from '@/lib/types/skill'
import { loadAppLocales, loadCharacters } from '@/utils/dataLoader'
import { isHeroModifier } from '@/utils/tagData'

const pick = (tag: string, ...mods: string[]): TagPick => ({ tag, mods })

// One attachment carrying both modifiers, against the same two modifiers on
// two different skills.
const together: CharacterTags = { debuff: [{ ultimate: 1, mods: ['eryndor', 'global'] }] }
const apart: CharacterTags = {
  debuff: [
    { ultimate: 1, mods: ['global'] },
    { skill2: 1, mods: ['eryndor'] },
  ],
}

describe('matching', () => {
  it('needs every modifier of a pick on one attachment', () => {
    expect(matchesPick(together, pick('debuff', 'global', 'eryndor'))).toBe(true)
    expect(matchesPick(apart, pick('debuff', 'global', 'eryndor'))).toBe(false)
    expect(matchesPick(apart, pick('debuff', 'global'))).toBe(true)
  })
})

describe('skill text', () => {
  const tags: CharacterTags = {
    'temp-buff': [{ skill3: 1 }, { skill3: 4, mods: ['opening'] }],
    dot: [{ skill3: 2 }],
  }

  it('tints the levels of the attachments that satisfy any of the picks', () => {
    expect(pinnedLevels(tags, [pick('temp-buff')], 'skill3')).toEqual([1, 4])
    expect(pinnedLevels(tags, [pick('temp-buff', 'opening')], 'skill3')).toEqual([4])
    expect(pinnedLevels(tags, [pick('temp-buff', 'opening'), pick('dot')], 'skill3')).toEqual([
      2, 4,
    ])
  })

  it('opens a hero on the picks it has text for, else on the tag it was clicked under', () => {
    const picks = [pick('temp-buff', 'opening'), pick('temp-buff', 'global'), pick('summon')]
    expect(openingPicks(tags, picks, 'dot')).toEqual([pick('temp-buff', 'opening')])
    expect(openingPicks(tags, [pick('temp-buff', 'global'), pick('summon')], 'temp-buff')).toEqual([
      pick('temp-buff'),
    ])
  })
})

describe('vocabulary', () => {
  const solo = (heroes: CharacterTags[]) =>
    tagVocabulary(heroes.map((tags) => ({ tags }))).get('ult')

  it('calls a tag solo only while every attachment carries its one modifier', () => {
    const opening = { ult: [{ ultimate: 1, mods: ['opening'] }] }
    expect(solo([opening, opening])!.solo).toBe('opening')
    expect(solo([opening, { ult: [{ ex: 1 }] }])!.solo).toBeNull()
    expect(solo([opening, { ult: [{ charm: 1 }, { ex: 1, mods: ['opening'] }] }])!.solo).toBeNull()
    expect(solo([opening, { ult: [{ ex: 1, mods: ['global'] }] }])!.solo).toBeNull()
  })
})

describe('tag links', () => {
  const vocabulary = tagVocabulary([
    { tags: { ...apart, ult: [{ ultimate: 1, mods: ['opening'] }], dot: [{ ex: 1 }] } },
  ])

  it('round-trips a pick, modifiers sorted', () => {
    const query = toTagQuery(pick('debuff', 'global', 'eryndor'))
    expect(query).toEqual({ tag: 'debuff', mods: 'eryndor,global' })
    expect(fromTagQuery(query, vocabulary)).toEqual(pick('debuff', 'eryndor', 'global'))
    expect(toTagQuery(pick('dot'))).toEqual({ tag: 'dot' })
  })

  it('reads a solo tag with or without its modifier as the same pick', () => {
    const opening = pick('ult', 'opening')
    expect(fromTagQuery({ tag: 'ult' }, vocabulary)).toEqual(opening)
    expect(fromTagQuery({ tag: 'ult', mods: 'opening' }, vocabulary)).toEqual(opening)
  })

  it('reads anything it does not know as no filter', () => {
    expect(fromTagQuery({ tag: 'stun' }, vocabulary)).toBeNull()
    expect(fromTagQuery({ tag: 'debuff', mods: 'global,opening' }, vocabulary)).toBeNull()
    expect(fromTagQuery({ tag: ['debuff', 'dot'] }, vocabulary)).toBeNull()
    expect(fromTagQuery({ tag: 'debuff', mods: ['global', 'eryndor'] }, vocabulary)).toBeNull()
  })
})

// A typo in a hero file would otherwise ship as a new tag or modifier, or pin
// a slot that does not exist. A tag without an attachment would match no pick.
describe('hero tag data', () => {
  const heroes = loadCharacters()
  const labels = loadAppLocales()

  it('labels every tag and modifier', () => {
    for (const { name, tags } of heroes) {
      for (const [tag, entries] of Object.entries(tags)) {
        expect(labels[tag], `${name}: tag "${tag}" has no label`).toBeDefined()
        for (const mod of entries.flatMap((entry) => entry.mods ?? [])) {
          expect(isHeroModifier(mod) || mod in labels, `${name}: modifier "${mod}"`).toBe(true)
        }
      }
    }
  })

  it('pins one slot per attachment', () => {
    for (const { name, tags } of heroes) {
      for (const [tag, entries] of Object.entries(tags)) {
        expect(entries.length, `${name}: tag "${tag}" has no attachment`).toBeGreaterThan(0)
        for (const entry of entries) {
          const pins = Object.keys(entry).filter((key) => key !== 'mods')
          expect(pins, `${name} ${tag}`).toHaveLength(1)
          expect(entryPin(entry), `${name} ${tag}: "${pins[0]}" is no slot`).not.toBeNull()
        }
      }
    }
  })
})
