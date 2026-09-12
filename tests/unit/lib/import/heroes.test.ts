import { describe, expect, it } from 'vitest'

import { paragonFromMatch, prepareFrameRefs } from '@/lib/import/frames'
import {
  assignUnique,
  buildHeroTable,
  decodeLearned,
  DESCRIPTOR_LENGTH,
  encodeLearned,
  heroDescriptor,
  rankHeroes,
} from '@/lib/import/heroes'
import { createImage, cropResize } from '@/lib/import/image'
import {
  addLearnedIcon,
  LEARNED_ICONS_CAP,
  parseLearnedIcons,
  serializeLearnedIcons,
} from '@/lib/import/learned'
import type { HeroCandidate, RgbaImage } from '@/lib/import/types'

const cand = (
  characterId: number,
  score: number,
  learned = false,
  costume = false,
): HeroCandidate => ({ characterId, score, learned, costume })

// A portrait with a distinct smooth pattern per hero: 180 × 248 art built from
// a few sinusoids, so resampling at different scales stays correlated.
const portrait = (seed: number): RgbaImage => {
  const img = createImage(180, 248)
  for (let y = 0; y < 248; y++) {
    for (let x = 0; x < 180; x++) {
      const i = (y * 180 + x) * 4
      img.data[i] = 128 + 100 * Math.sin(x / (7 + seed) + y / 11)
      img.data[i + 1] = 128 + 100 * Math.cos(y / (9 + seed * 2) - x / 13)
      img.data[i + 2] = 128 + 100 * Math.sin((x + y) / (5 + seed * 3))
      img.data[i + 3] = 255
    }
  }
  return img
}

describe('assignUnique', () => {
  it('gives a hero read on two rows to the surer row and reports the pick first', () => {
    const rows = [
      [cand(7, 0.8), cand(9, 0.5)],
      [cand(7, 0.6), cand(3, 0.55)],
    ]
    const out = assignUnique(rows)
    expect(out[0]!.candidates[0]!.characterId).toBe(7)
    expect(out[0]!.margin).toBeCloseTo(0.3)
    expect(out[0]!.sure).toBe(true)
    expect(out[1]!.candidates[0]!.characterId).toBe(3)
    // Hero 7 is taken, so the row has no rival left and its score stands as the lead.
    expect(out[1]!.margin).toBeCloseTo(0.55)
  })

  it('keeps candidates under the floor as hints only', () => {
    const out = assignUnique([[cand(1, 0.2), cand(2, 0.1)]])
    expect(out[0]!.recognised).toBe(false)
    expect(out[0]!.candidates.map((c) => c.characterId)).toEqual([1, 2])
  })

  it('measures a learned pick against the best bundled rival', () => {
    const out = assignUnique([[cand(5, 0.9, true), cand(5, 0.85), cand(6, 0.7)]])
    expect(out[0]!.candidates[0]!.learned).toBe(true)
    expect(out[0]!.margin).toBeCloseTo(0.2)
  })

  it('holds a costume-backed pick to the higher bar', () => {
    expect(assignUnique([[cand(5, 0.8, false, true), cand(6, 0.68)]])[0]!.sure).toBe(false)
    expect(assignUnique([[cand(5, 0.8), cand(6, 0.68)]])[0]!.sure).toBe(true)
    expect(assignUnique([[cand(5, 0.8, false, true), cand(6, 0.6)]])[0]!.sure).toBe(true)
  })
})

describe('hero table', () => {
  it('recognises a face crop of a stored portrait', () => {
    const portraits = [1, 2, 3].map((id) => ({ characterId: id, image: portrait(id) }))
    const table = buildHeroTable(portraits)
    expect(table.ids.length).toBe(3 * 60)
    // The in-game card shows a head crop: take the same region from hero 2's art.
    const shot = portrait(2)
    const face = heroDescriptor(shot, { x: 44, y: 60, w: 96, h: 72 })
    const ranked = rankHeroes(table, [face])
    expect(ranked[0]!.characterId).toBe(2)
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score + 0.1)
  })

  it("recognises a costume reference framed like the game's skin card", () => {
    // The card shows the same painting at 60% size, higher and centred, with a
    // margin around it, so the face falls outside the art grid's windows.
    const card = createImage(180, 248)
    card.data.fill(255)
    const small = cropResize(portrait(2), { x: 0, y: 0, w: 180, h: 248 }, 108, 149)
    for (let y = 0; y < 149; y++) {
      for (let x = 0; x < 108; x++) {
        const from = (y * 108 + x) * 4
        const to = ((y + 8) * 180 + x + 36) * 4
        card.data.set(small.data.subarray(from, from + 4), to)
      }
    }
    const table = buildHeroTable([
      { characterId: 1, image: portrait(1) },
      { characterId: 2, image: card, costume: true },
      { characterId: 3, image: portrait(3) },
    ])
    expect(table.ids.length).toBe(60 + 96 + 60)
    const face = heroDescriptor(portrait(2), { x: 44, y: 60, w: 96, h: 72 })
    const ranked = rankHeroes(table, [face])
    expect(ranked[0]!.characterId).toBe(2)
    expect(ranked[0]!.costume).toBe(true)
  })

  it('round-trips a learned descriptor', () => {
    const v = new Float32Array(DESCRIPTOR_LENGTH).map((_, i) => Math.sin(i) * 0.2)
    const back = decodeLearned(encodeLearned(v))!
    expect(back.length).toBe(DESCRIPTOR_LENGTH)
    expect(back[1]! / 400).toBeCloseTo(v[1]!, 2)
    expect(decodeLearned('nope')).toBeNull()
  })
})

describe('learned icon envelope', () => {
  const v = new Float32Array(DESCRIPTOR_LENGTH).fill(0.01)

  it('serialises, parses, and drops a store with a different descriptor spec', () => {
    const icons = addLearnedIcon([], 80, v, 10)
    const raw = serializeLearnedIcons(icons)
    expect(parseLearnedIcons(raw)).toEqual(icons)
    expect(parseLearnedIcons(raw.replace('"box":[', '"box":[9,'))).toEqual([])
    expect(parseLearnedIcons('{')).toEqual([])
    expect(parseLearnedIcons(null)).toEqual([])
  })

  it('keeps the newest entries under the cap', () => {
    let icons = addLearnedIcon([], 1, v, 0)
    for (let i = 1; i <= LEARNED_ICONS_CAP; i++) icons = addLearnedIcon(icons, i, v, i)
    expect(icons.length).toBe(LEARNED_ICONS_CAP)
    expect(icons[0]!.learnedAt).toBe(1)
  })
})

describe('paragonFromMatch', () => {
  const refs = prepareFrameRefs([createImage(280, 404)])
  const ref = refs[0]!
  it('flags low scores and close families', () => {
    expect(
      paragonFromMatch({
        ref,
        score: 0.7,
        box: { x: 0, y: 0, w: 1, h: 1 },
        perLevel: [0.7, 0.4, 0.4, 0.4, 0.4],
      }).sure,
    ).toBe(true)
    expect(
      paragonFromMatch({
        ref,
        score: 0.58,
        box: { x: 0, y: 0, w: 1, h: 1 },
        perLevel: [0.58, 0.5, 0.56, 0.4, 0.4],
      }).sure,
    ).toBe(false)
    expect(
      paragonFromMatch({
        ref,
        score: 0.42,
        box: { x: 0, y: 0, w: 1, h: 1 },
        perLevel: [0.42, 0.1, 0.1, 0.1, 0.1],
      }).sure,
    ).toBe(false)
  })
})
