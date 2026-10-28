import { effectScope, reactive, type EffectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRosterImport, type RosterImportShot } from '@/composables/useRosterImport'
import { ATTR_PARAGON } from '@/lib/characters/attributes'
import type { FrameFamily, HeroReading } from '@/lib/import/card/types'
import type { RosterSlot } from '@/lib/import/screens/roster/types'
import { createImage } from '../fixtures/image'
import { FakeWorker, file, stubImportBrowser } from '../fixtures/importBrowser'

// A card the reader read as hero 7 without being sure, on a surely placed frame.
const unsure = (descriptor: number): HeroReading => ({
  candidates: [{ characterId: 7, score: 0.7, learned: false, costume: false }],
  recognised: true,
  sure: false,
  margin: 0.01,
  box: { x: 0, y: 0, w: 1, h: 1 },
  card: createImage(1, 1),
  descriptor: new Float32Array(1).fill(descriptor),
  paragon: { level: 2, score: 0.8, runnerUp: 0.5, sure: true },
  refinement: { level: 0, full: true, family: 'white', sure: true },
})

const slot = (col: number, cell: HeroReading, family: FrameFamily = 'paragon'): RosterSlot => ({
  row: 0,
  col,
  hands: false,
  box: { x: 0, y: 0, w: 1, h: 1 },
  kind: 'card',
  inView: 1,
  frame: { family, sure: true },
  cell,
})

const shot = (id: string, slots: RosterSlot[]): RosterImportShot =>
  reactive({
    id,
    kind: 'roster',
    name: `${id}.png`,
    size: 1,
    thumb: `blob:${id}`,
    marked: null,
    status: 'ready',
    error: null,
    reading: { grid: null, slots },
    overrides: {},
    cards: {},
  }) as RosterImportShot

let scope: EffectScope | null = null
const holdImport = () => {
  scope ??= effectScope()
  return scope.run(() => useRosterImport())!
}

afterEach(() => {
  holdImport().forgetLearned()
  scope?.stop()
  scope = null
  vi.unstubAllGlobals()
})

describe('roster import', () => {
  it('corrects every card of a hero, teaching one face, and sets a level on each', () => {
    const api = holdImport()
    // One card seen in two screenshots, both unsure of the hero.
    api.shots.value = [shot('a', [slot(0, unsure(0.1))]), shot('b', [slot(2, unsure(0.2))])]
    const cards = [
      { shotId: 'a', key: '1.1' },
      { shotId: 'b', key: '1.3' },
    ]

    api.setHero(cards, 9)
    expect(api.shots.value.map((s) => Object.values(s.overrides))).toEqual([
      [{ characterId: 9 }],
      [{ characterId: 9 }],
    ])
    expect(api.learnedCount.value).toBe(1)

    api.setLevel(cards, 'paragon', 3)
    expect(api.plan.value.heroes).toEqual({ 9: { [ATTR_PARAGON]: 3 } })

    api.removeShot('a')
    expect(api.plan.value.entries.map((e) => e.cards.map((c) => c.shotId))).toEqual([['b']])
  })

  it('takes back what each card of a hero was taught when they are corrected as one', () => {
    const api = holdImport()
    api.shots.value = [shot('a', [slot(0, unsure(0.1))]), shot('b', [slot(2, unsure(0.2))])]
    const a = { shotId: 'a', key: '1.1' }
    const b = { shotId: 'b', key: '1.3' }
    // Corrected apart while they disagreed, each teaches its own face.
    api.setHero([b], 9)
    api.setHero([a], 9)
    expect(api.learnedCount.value).toBe(2)

    api.setHero([a, b], null)
    expect(api.learnedCount.value).toBe(0)
  })

  it('confirms every doubtful part of the heroes with no issue as read, teaching no face', () => {
    const api = holdImport()
    const allUnsure: HeroReading = {
      ...unsure(0.1),
      paragon: { level: 2, score: 0.8, runnerUp: 0.79, sure: false },
      refinement: { level: 0, full: true, family: 'white', sure: false },
    }
    // Hero 8 on two cards of one screenshot is the reviewer's to settle.
    const eight: HeroReading = {
      ...unsure(0.2),
      candidates: [{ characterId: 8, score: 0.7, learned: false, costume: false }],
    }
    api.shots.value = [shot('a', [slot(0, allUnsure), slot(1, eight), slot(2, eight)])]

    api.confirmAll()
    expect(api.shots.value[0]!.overrides).toEqual({
      '1.1': { characterId: 7, paragon: 2, refinement: 0 },
    })
    expect(api.learnedCount.value).toBe(0)
    expect(api.plan.value.entries.map((e) => [e.characterId, e.check])).toEqual([
      [8, true],
      [7, false],
    ])
  })

  it('refuses a screenshot the sorter finds to be a match screen, and reads one it cannot place', async () => {
    stubImportBrowser()
    const api = holdImport()
    FakeWorker.sortAs = 'result'
    expect(await api.addFiles([file('match.png')])).toEqual({ added: 0, refused: 1 })
    FakeWorker.sortAs = null
    expect(await api.addFiles([file('roster.png')])).toEqual({ added: 1, refused: 0 })
    expect(api.shots.value.map((s) => s.name)).toEqual(['roster.png'])
  })

  it('teaches on a surely placed paragon frame whatever its level, and never below S+', () => {
    const api = holdImport()
    const levelUnsure: HeroReading = {
      ...unsure(0.1),
      paragon: { level: 2, score: 0.8, runnerUp: 0.79, sure: false },
    }
    api.shots.value = [shot('a', [slot(0, levelUnsure), slot(1, unsure(0.2), 'below')])]
    api.setHero([{ shotId: 'a', key: '1.1' }], 9)
    expect(api.learnedCount.value).toBe(1)
    api.setHero([{ shotId: 'a', key: '1.2' }], 9)
    expect(api.shots.value[0]!.overrides['1.2']).toEqual({ characterId: 9 })
    expect(api.learnedCount.value).toBe(1)
  })
})
