import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import type { FrameFamily, HeroReading } from '@/lib/import/card/types'
import type { CellOverride } from '@/lib/import/review'
import type { RosterSlot } from '@/lib/import/screens/roster/types'
import { buildRosterImportPlan, shotToCheck, type RosterShotInput } from '@/lib/rosterImport'
import { createImage } from '../fixtures/image'

const reading = (
  characterId: number | null,
  { sure = true, paragon = 0, refinement = 0 } = {},
): HeroReading => ({
  candidates:
    characterId === null ? [] : [{ characterId, score: 0.9, learned: false, costume: false }],
  recognised: characterId !== null,
  margin: 0.2,
  sure,
  box: { x: 0, y: 0, w: 1, h: 1 },
  card: createImage(1, 1),
  descriptor: new Float32Array(1),
  paragon: { level: paragon, score: 0.8, runnerUp: 0.5, sure: true },
  refinement: { level: refinement, full: true, family: 'white', sure: true },
})

// A slot at a key: h1 to h5 for the Hands, row.col down the grid.
const card = (
  key: string,
  cell: HeroReading | null,
  family: FrameFamily = 'paragon',
): RosterSlot => {
  const hands = key.startsWith('h')
  const [row, col] = hands
    ? [-1, Number(key.slice(1)) - 1]
    : key.split('.').map((n) => Number(n) - 1)
  return {
    row: row!,
    col: col!,
    hands,
    box: { x: 0, y: 0, w: 1, h: 1 },
    kind: cell ? 'card' : 'clipped',
    inView: 1,
    frame: cell ? { family, sure: true } : null,
    cell,
  }
}

const shot = (
  id: string,
  slots: RosterSlot[],
  overrides: Record<string, CellOverride> = {},
): RosterShotInput => ({ id, reading: { grid: null, slots }, overrides })

const levels = (paragon: number, refinement: number) => ({
  ...(paragon ? { [ATTR_PARAGON]: paragon } : {}),
  ...(refinement ? { [ATTR_REFINEMENT]: refinement } : {}),
})

describe('buildRosterImportPlan', () => {
  it('takes a hero seen in the Hands of one screenshot and the grid of another once', () => {
    const plan = buildRosterImportPlan([
      shot('a', [card('h1', reading(7, { paragon: 4, refinement: 2 })), card('1.1', reading(8))]),
      shot('b', [card('2.3', reading(7, { paragon: 4, refinement: 2 })), card('2.4', null)]),
    ])
    expect(plan.entries.map((e) => [e.characterId, e.cards.length, e.check])).toEqual([
      [7, 2, false],
      [8, 1, false],
    ])
    expect(plan.heroes).toEqual({ 7: levels(4, 2), 8: {} })
    expect(plan.blocked).toBe(false)
  })

  it('asks about a repeat with an unsure card first, without holding back Save', () => {
    const unsure = [
      shot('a', [card('1.1', reading(7, { paragon: 2 }))]),
      shot('b', [card('1.1', reading(9)), card('1.2', reading(7, { sure: false, paragon: 2 }))]),
    ]
    const plan = buildRosterImportPlan(unsure)
    expect(plan.entries[0]).toMatchObject({ characterId: 7, issues: ['repeat'], check: true })
    expect(plan.blocked).toBe(false)

    const confirmed = [unsure[0]!, { ...unsure[1]!, overrides: { '1.2': { characterId: 7 } } }]
    expect(buildRosterImportPlan(confirmed).entries.map((e) => e.check)).toEqual([false, false])
  })

  it("holds back Save while a hero's cards disagree on its levels, until one is corrected", () => {
    const shots = [
      shot('a', [card('1.1', reading(7, { paragon: 3 }))]),
      shot('b', [card('2.1', reading(7, { paragon: 2 }))]),
    ]
    const plan = buildRosterImportPlan(shots)
    expect(plan.entries[0]).toMatchObject({ paragon: null, issues: ['levels'], check: true })
    expect(plan.heroes).toEqual({})
    expect(plan.blocked).toBe(true)

    const fixed = buildRosterImportPlan([
      shots[0]!,
      { ...shots[1]!, overrides: { '2.1': { paragon: 3 } } },
    ])
    expect(fixed.heroes).toEqual({ 7: levels(3, 0) })
    expect(fixed.blocked).toBe(false)
  })

  it('holds back Save with one hero on two cards of one screenshot', () => {
    const plan = buildRosterImportPlan([
      shot('a', [card('1.1', reading(7)), card('1.2', reading(8))], { '1.2': { characterId: 7 } }),
    ])
    expect(plan.entries[0]).toMatchObject({ characterId: 7, issues: ['twice'] })
    expect(plan.blocked).toBe(true)
  })

  it('drops a card removed in review and lists a card with no hero apart', () => {
    const plan = buildRosterImportPlan([
      shot('a', [card('1.1', reading(7)), card('1.2', reading(8)), card('1.3', reading(null))], {
        '1.2': { characterId: null },
      }),
    ])
    expect(plan.entries.map((e) => e.characterId)).toEqual([7])
    expect(plan.unnamed.map((c) => [c.key, c.state])).toEqual([['1.3', 'none']])
    expect(plan.heroes).toEqual({ 7: {} })
  })

  it('gives the same plan whichever screenshot is read first', () => {
    const a = shot('a', [card('1.1', reading(7, { paragon: 1 })), card('1.2', reading(5))])
    const b = shot('b', [
      card('1.1', reading(6, { sure: false })),
      card('1.2', reading(7, { paragon: 1 })),
    ])
    const strip = (plan: ReturnType<typeof buildRosterImportPlan>) => ({
      ...plan,
      entries: plan.entries.map((e) => ({
        ...e,
        cards: e.cards.map((c) => `${c.shotId}:${c.key}`).sort(),
      })),
    })
    expect(strip(buildRosterImportPlan([b, a]))).toEqual(strip(buildRosterImportPlan([a, b])))
    expect(buildRosterImportPlan([a, b]).entries.map((e) => e.characterId)).toEqual([6, 5, 7])
  })
})

describe('shotToCheck', () => {
  it('counts the heroes to check first and the unnamed cards each screenshot shows', () => {
    const a = shot('a', [
      card('1.1', reading(5)),
      card('1.2', reading(6, { sure: false })),
      card('1.3', reading(null)),
    ])
    const b = shot('b', [card('1.1', reading(6)), card('1.2', reading(7))])
    const plan = buildRosterImportPlan([a, b])
    expect([shotToCheck(plan, 'a'), shotToCheck(plan, 'b')]).toEqual([2, 1])
  })
})
