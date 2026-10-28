import { describe, expect, it } from 'vitest'

import type { HeroReading } from '@/lib/import/card/types'
import type { MatchupPanel, MatchupTeam } from '@/lib/import/screens/matchup/types'
import { buildWwwImportPlan, type WwwShotInput } from '@/lib/pvp/sl/www/wwwImport'
import { createImage } from '../fixtures/image'

const hero = (characterId: number, { sure = true, paragon = 0 } = {}): HeroReading => ({
  candidates: [{ characterId, score: 0.9, learned: false, costume: false }],
  recognised: true,
  margin: 0.2,
  sure,
  box: { x: 0, y: 0, w: 1, h: 1 },
  card: createImage(1, 1),
  descriptor: new Float32Array(1),
  paragon: { level: paragon, score: 0.8, runnerUp: 0.5, sure: true },
  refinement: { level: 0, full: true, family: 'white', sure: true },
})

// Game g's left team fields heroes 10g+1 to 10g+5 and artifact 200+g, its right
// team heroes 100+10g+1 to 100+10g+5 and artifact 300+g. A cut panel shows its
// bars and artifacts but not its cards; `sure` is its artifacts' reading.
const team = (first: number, artifact: number, cut: boolean, sure: boolean): MatchupTeam => ({
  bar: { x: 0, y: 0, w: 1, h: 1 },
  cards: cut ? null : [1, 2, 3, 4, 5].map((k) => hero(first + k)),
  artifact: {
    card: createImage(1, 1),
    candidates: [{ artifactId: artifact, score: 0.9 }],
    margin: 0.2,
    sure,
  },
})
const game = (g: number, { cut = false, sure = false } = {}): MatchupPanel => ({
  blue: team(10 * g, 200 + g, cut, sure),
  red: team(100 + 10 * g, 300 + g, cut, sure),
})

const shot = (id: string, panels: MatchupPanel[]): WwwShotInput => ({
  id,
  reading: { panels },
  overrides: {},
  artifacts: {},
})

const leftHeroes = (plan: ReturnType<typeof buildWwwImportPlan>, g: number) =>
  plan.fill[g - 1]!.a.heroes.map((h) => h?.id ?? null)

describe('buildWwwImportPlan', () => {
  it('places two screenshots by the teams they share, whichever is added first', () => {
    const first = shot('first', [game(1), game(2), game(3), game(4)])
    const second = shot('second', [game(3), game(4), game(5)])
    for (const shots of [
      [first, second],
      [second, first],
    ]) {
      const plan = buildWwwImportPlan(shots)
      expect(plan.numbers).toEqual({ first: [1, 2, 3, 4], second: [3, 4, 5] })
      expect(plan.games[2]!.a.slots[0]!.cards).toHaveLength(2)
      expect(leftHeroes(plan, 5)).toEqual([51, 52, 53, 54, 55])
      expect(plan.missing).toEqual([])
      expect(plan.blocked).toBe(false)
    }
  })

  it('puts a screenshot whose last game is cut before one that shows its last game whole', () => {
    // Nothing links the two: the cut game shows no cards, and its artifacts are not sure.
    const cut = shot('cut', [game(1), game(2), game(3), game(4, { cut: true })])
    const end = shot('end', [game(4), game(5)])
    const plan = buildWwwImportPlan([end, cut])
    // Six panels for five games: the two around the seam are one game.
    expect(plan.numbers).toEqual({ cut: [1, 2, 3, 4], end: [4, 5] })
    expect(leftHeroes(plan, 4)).toEqual([41, 42, 43, 44, 45])
    expect(plan.otherMatch).toBe(false)
  })

  it('links a cut panel by its sure artifact, and leaves the games not shown empty', () => {
    const cut = shot('cut', [game(1), game(2), game(3, { cut: true, sure: true })])
    const next = shot('next', [game(3, { sure: true }), game(4)])
    const plan = buildWwwImportPlan([cut, next])
    expect(plan.numbers).toEqual({ cut: [1, 2, 3], next: [3, 4] })
    expect(plan.games[2]!.a.badges).toHaveLength(2)
    expect(plan.missing).toEqual([5])
    expect(plan.fill[4]).toBeNull()
    expect(plan.blocked).toBe(false)
  })

  it('lets a sure reading of a card stand over an unsure one, and asks when sure ones differ', () => {
    const again = game(1)
    again.blue.cards![0] = hero(99, { sure: false })
    again.blue.cards![1] = hero(12, { paragon: 3 })
    const plan = buildWwwImportPlan([shot('one', [game(1)]), shot('two', [again])])
    expect(plan.numbers).toEqual({ one: [1], two: [1] })
    const [kept, differ] = plan.games[0]!.a.slots
    expect(kept).toMatchObject({ characterId: 11, state: 'sure', issues: [] })
    expect(differ).toMatchObject({ characterId: 12, doubtful: ['paragon'], issues: ['differ'] })
    expect(plan.blocked).toBe(true)
  })

  it('calls more than five games, or links that disagree, another match', () => {
    const five = shot('five', [game(1), game(2), game(3), game(4), game(5)])
    const past = buildWwwImportPlan([five, shot('past', [game(5), game(6)])])
    expect(past.numbers.past).toEqual([5, 6])
    expect(past.otherMatch).toBe(true)
    expect(past.blocked).toBe(true)

    const torn = buildWwwImportPlan([five, shot('torn', [game(2), game(4)])])
    expect(torn.otherMatch).toBe(true)
    expect(torn.blocked).toBe(true)
  })
})
