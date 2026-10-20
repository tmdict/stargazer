import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  disposeTeamImport,
  shotMapIndex,
  shotWinner,
  useTeamImport,
  type ImportShot,
} from '@/composables/useTeamImport'
import { PHANTIMAL_COMPANION_STRIDE, toPhantimalId } from '@/lib/characters/phantimal'
import { DESCRIPTOR_LENGTH } from '@/lib/import/heroes'
import { readLearnedIcons } from '@/lib/import/learned'
import type { FormationReading, ReplayReading } from '@/lib/import/types'
import { stubLocalStorage } from '../fixtures/storage'

vi.mock('@/stores/gameData', () => ({ useGameDataStore: vi.fn() }))
vi.mock('@/utils/dataLoader', () => ({
  loadMatcherPortraits: vi.fn(),
  loadArtifacts: () => [],
  loadPhantimals: () => [],
}))

const shot = (): ImportShot => ({
  id: 'sample',
  kind: 'result',
  name: 'sample.png',
  size: 11,
  thumb: 'blob:sample',
  status: 'ready',
  error: null,
  overrides: {},
  artifactOverrides: {},
  resultOverrides: {},
  cards: {},
  artifactCards: {},
  unitOverrides: {},
  unitCards: [],
  tilePicks: {},
  reading: {
    mapIndex: 3,
    mapCount: 5,
    winner: 1,
    mapResults: [1, null, null, 1, null],
    warnings: [],
    artifacts: {
      1: {
        card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
        candidates: [{ artifactId: 8, score: 0.5 }],
        margin: 0.1,
        sure: true,
      },
      2: null,
    },
    sides: {
      1: [
        {
          box: { x: 0, y: 0, w: 10, h: 10 },
          card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
          descriptor: new Float32Array(1),
          candidates: [{ characterId: 5, score: 0.8, learned: false, costume: false }],
          recognised: true,
          sure: true,
          margin: 0.3,
          paragon: { level: 4, score: 0.8, runnerUp: 0.2, sure: true },
          refinement: { level: 0, family: 'white', stars: 6, sure: true },
        },
      ],
      2: [],
    },
  },
})

afterEach(() => {
  useTeamImport(
    () => '5v5',
    () => false,
  ).forgetLearned()
  disposeTeamImport()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('learning from corrections', () => {
  it('teaches an unsure cell, replaces the lesson on a second pick, and takes it back', () => {
    vi.stubEnv('SSR', false)
    const { storage } = stubLocalStorage()
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    const learnedIds = (): number[] =>
      readLearnedIcons(JSON.parse(storage.get('stargazer.import.learned') ?? 'null')).map(
        (i) => i.characterId,
      )
    const sample = shot()
    const cell = sample.reading!.sides[1][0]!
    cell.sure = false
    cell.descriptor = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
    api.shots.value = [sample]
    api.setHero('sample', 1, 0, 7)
    expect(learnedIds()).toEqual([7])
    api.setHero('sample', 1, 0, 9)
    expect(learnedIds()).toEqual([9])
    api.setHero('sample', 1, 0, 5)
    expect(learnedIds()).toEqual([])
    expect(api.learnedCount.value).toBe(0)
  })

  it('never teaches a sure cell or one whose frame match was doubtful', () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    const sample = shot()
    const cell = sample.reading!.sides[1][0]!
    cell.descriptor = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
    api.shots.value = [sample]
    api.setHero('sample', 1, 0, 7)
    cell.sure = false
    cell.paragon.sure = false
    api.setHero('sample', 1, 0, 9)
    expect(api.learnedCount.value).toBe(0)
  })
})

describe('shot map and winner', () => {
  it('derives the map from the choice, else the strip within the mode, else the sole board', () => {
    const s = shot()
    expect(shotMapIndex(s, 5)).toBe(3)
    expect(shotMapIndex(s, 3)).toBeNull()
    expect(shotMapIndex(s, 1)).toBe(0)
    expect(shotWinner(s)).toBe(1)

    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    api.shots.value = [s]
    api.setMap('sample', 1)
    api.setWinner('sample', 2)
    expect(shotMapIndex(s, 5)).toBe(1)
    expect(shotWinner(s)).toBe(2)
    api.setMap('sample', null)
    api.setWinner('sample', null)
    expect(shotMapIndex(s, 5)).toBeNull()
    expect(shotWinner(s)).toBeNull()
  })

  it('keeps a map chosen before the reading arrived', () => {
    const s: ImportShot = { ...shot(), reading: null, status: 'reading' }
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    api.shots.value = [s]
    api.setMap('sample', 2)
    s.reading = shot().reading
    expect(shotMapIndex(s, 5)).toBe(2)
  })
})

describe('board sides', () => {
  it("swaps the result screenshot's columns onto the opposite sides until the shots go", () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    api.shots.value = [shot()]
    api.swapSides.value = true
    const board = api.plan.value.boards[3]!
    expect(board.sides[2]!.mains.map((unit) => unit.unitId)).toEqual([5])
    expect(board.sides[2]!.artifact).toBe(8)
    expect(board.sides[1]).toEqual({ mains: [], companions: [], phantimal: null, artifact: null })
    api.clearImport()
    expect(api.swapSides.value).toBe(false)
  })

  it('sets Swap sides from the formation shots and leaves it to the user after', async () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    const result = shot()
    // The Ally column's hero on the enemy half: the match is swapped.
    const formation: FormationReading = {
      ...result.reading!,
      size: { width: 640, height: 760 },
      board: { scale: 46, x: 0, y: 0, support: 0.7 },
      side: 2,
      tiles: [],
      unclear: [],
      units: [
        {
          hexId: 40,
          ring: { x: 0, y: 0, radius: 1 },
          score: 1,
          candidates: [{ characterId: 5, score: 0.9, learned: false, costume: false }],
          card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
        },
      ],
    }
    api.shots.value = [
      result,
      { ...shot(), id: 'formation', kind: 'formation', reading: formation },
    ]
    await nextTick()
    expect(api.formationSwap.value).toBe(true)
    expect(api.swapSides.value).toBe(true)
    expect(api.plan.value.boards[3]!.sides[2]!.mains.map((unit) => unit.unitId)).toEqual([5])

    // The swap starts the portrait corrections over and keeps the tile picks.
    api.setUnit('formation', 0, 5)
    api.setTilePick('formation', 2, 41, 6)
    api.swapSides.value = false
    await nextTick()
    expect(api.swapSides.value).toBe(false)
    expect(api.shots.value[1]!.unitOverrides).toEqual({})
    expect(api.shots.value[1]!.tilePicks).toEqual({ 2: { 41: 6 } })
    // With the shots unable to tell, the choice stays.
    api.shots.value = [result]
    await nextTick()
    expect(api.swapSides.value).toBe(false)
  })
})

describe('a match import', () => {
  it('leaves out a formation shot when the only result shot failed to read', () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    const result = shot()
    const unit = {
      hexId: 1,
      ring: { x: 0, y: 0, radius: 1 },
      score: 1,
      candidates: [{ characterId: 5, score: 0.9, learned: false, costume: false }],
      card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
    }
    const formation: FormationReading = {
      ...result.reading!,
      mapIndex: 0,
      size: { width: 640, height: 760 },
      board: { scale: 46, x: 0, y: 0, support: 0.7 },
      side: 1,
      tiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16],
      unclear: [],
      units: [unit],
    }
    api.shots.value = [
      { ...result, id: 'unread', status: 'failed', error: 'read', reading: null },
      { ...shot(), id: 'formation', kind: 'formation', reading: formation },
    ]
    // Read alone, the formation shot would place its own cards' heroes.
    expect(api.plan.value.boards[0]).toBeNull()
    expect(api.plan.value.issues).toContainEqual({
      kind: 'formation-unused',
      team: 1,
      mapIndex: 0,
    })
  })
})

describe('replay tile picks', () => {
  it('moves a unit picked for another tile and replaces what a tile held', () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    api.shots.value = [{ ...shot(), kind: 'replay' }]
    const picks = () => api.shots.value[0]!.tilePicks[1]
    api.setTilePick('sample', 1, 1, 7)
    api.setTilePick('sample', 1, 2, 7)
    expect(picks()).toEqual({ 2: 7 })
    api.setTilePick('sample', 1, 3, 9)
    api.setTilePick('sample', 1, 2, 9)
    expect(picks()).toEqual({ 2: 9 })
    api.setTilePick('sample', 1, 2, null)
    expect(picks()).toEqual({})
  })

  it("drops a side's picks of another phantimal's units, as the side fields one", () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    api.shots.value = [{ ...shot(), kind: 'replay' }]
    const [first, second] = [toPhantimalId(1), toPhantimalId(2)]
    const companionOf = (phantimal: number): number => phantimal + PHANTIMAL_COMPANION_STRIDE
    api.setTilePick('sample', 1, 1, first)
    api.setTilePick('sample', 1, 2, companionOf(first))
    api.setTilePick('sample', 1, 3, 7)
    api.setTilePick('sample', 2, 4, first)
    api.setTilePick('sample', 1, 5, companionOf(second))
    expect(api.shots.value[0]!.tilePicks).toEqual({
      1: { 3: 7, 5: companionOf(second) },
      2: { 4: first },
    })
  })

  it("starts a frame's picks over when it moves to another board", () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    const reading: ReplayReading = {
      ...shot().reading!,
      size: { width: 1400, height: 1940 },
      placement: { scale: 1, x: 0, y: 0, score: 0.8 },
    }
    api.shots.value = [{ ...shot(), kind: 'replay', reading }]
    api.setTilePick('sample', 1, 1, 7)
    api.setMap('sample', 3)
    expect(api.shots.value[0]!.tilePicks).toEqual({ 1: { 1: 7 } })
    api.setMap('sample', 2)
    expect(api.shots.value[0]!.tilePicks).toEqual({})
  })

  it('leaves out a frame the arena was not found in', () => {
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    const reading: ReplayReading = {
      ...shot().reading!,
      mapIndex: null,
      size: { width: 1400, height: 1940 },
      placement: null,
    }
    api.shots.value = [shot(), { ...shot(), id: 'frame', kind: 'replay', reading }]
    expect(api.plan.value.issues.some((issue) => issue.kind === 'unmapped')).toBe(false)
  })
})

describe('clearing an import', () => {
  it('drops unsaved name edits back to the names last saved', () => {
    vi.stubEnv('SSR', false)
    stubLocalStorage()
    const api = useTeamImport(
      () => '5v5',
      () => false,
    )
    api.names.left = 'unii'
    api.saveNames()
    api.names.left = 'typo'
    api.names.right = 'BTrickz'
    api.clearImport()
    expect(api.names.left).toBe('unii')
    expect(api.names.right).toBe('')
  })
})
