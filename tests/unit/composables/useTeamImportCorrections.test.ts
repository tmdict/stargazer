import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  disposeTeamImport,
  shotMapIndex,
  shotWinner,
  useTeamImport,
  type ImportShot,
} from '@/composables/useTeamImport'
import { DESCRIPTOR_LENGTH, encodeLearned } from '@/lib/import/heroes'
import { readLearnedIcons } from '@/lib/import/learned'

vi.mock('@/stores/gameData', () => ({ useGameDataStore: vi.fn() }))
vi.mock('@/utils/dataLoader', () => ({
  loadMatcherPortraits: vi.fn(),
  loadArtifacts: () => [],
  loadPhantimals: () => [],
  loadArenas: () => ({}),
}))

const shot = (): ImportShot => ({
  id: 'sample',
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
          refinement: { level: 0, family: 'white', stars: 6 },
        },
      ],
      2: [],
    },
  },
})

afterEach(() => {
  useTeamImport(() => '5v5').forgetLearned()
  disposeTeamImport()
  vi.unstubAllGlobals()
})

describe('learning from corrections', () => {
  it('teaches an unsure cell, replaces the lesson on a second pick, and takes it back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('image bytes')),
    )
    const api = useTeamImport(() => '5v5')
    const learnedIds = async (): Promise<number[]> => {
      const exported = JSON.parse(await api.exportCorrections()) as { learnedIcons: unknown }
      return readLearnedIcons(exported.learnedIcons).map((i) => i.characterId)
    }
    const sample = shot()
    const cell = sample.reading!.sides[1][0]!
    cell.sure = false
    cell.descriptor = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
    api.shots.value = [sample]
    api.setHero('sample', 1, 0, 7)
    expect(await learnedIds()).toEqual([7])
    api.setHero('sample', 1, 0, 9)
    expect(await learnedIds()).toEqual([9])
    api.setHero('sample', 1, 0, 5)
    expect(await learnedIds()).toEqual([])
    expect(api.learnedCount.value).toBe(0)
  })

  it('never teaches a sure cell or one whose frame match was doubtful', () => {
    const api = useTeamImport(() => '5v5')
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

    const api = useTeamImport(() => '5v5')
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
    const api = useTeamImport(() => '5v5')
    api.shots.value = [s]
    api.setMap('sample', 2)
    s.reading = shot().reading
    expect(shotMapIndex(s, 5)).toBe(2)
  })
})

describe('board sides', () => {
  it('swaps every screenshot onto the opposite sides, outside the corrections, until the shots go', async () => {
    const api = useTeamImport(() => '5v5')
    api.shots.value = [shot()]
    api.swapSides.value = true
    const board = api.plan.value.boards[3]!
    expect(board.sides[2].map((e) => e.characterId)).toEqual([5])
    expect(board.sides[1]).toEqual([])
    expect(board.artifacts).toEqual({ ally: null, enemy: 8 })
    expect(api.hasCorrections.value).toBe(false)
    expect(await api.exportCorrections()).not.toContain('swap')
    api.clearShots()
    expect(api.swapSides.value).toBe(false)
  })
})

describe('download import corrections', () => {
  it('exports explicit labels and original image hashes without pixels or unreviewed guesses as labels', async () => {
    const fetchImage = vi.fn(async () => new Response('image bytes'))
    vi.stubGlobal('fetch', fetchImage)
    const api = useTeamImport(() => '5v5')
    api.shots.value = [shot(), { ...shot(), id: 'untouched', name: 'untouched.png' }]
    expect(api.hasCorrections.value).toBe(false)
    api.setHero('sample', 1, 0, 7)
    api.setLevel('sample', 1, 0, 'paragon', 0)
    api.setArtifact('sample', 1, null)
    api.setMap('sample', 0)
    api.setWinner('sample', 1)
    expect(api.hasCorrections.value).toBe(true)
    expect(fetchImage).not.toHaveBeenCalled()

    const pending = api.exportCorrections()
    api.setHero('sample', 1, 0, 9)
    const raw = await pending
    expect(JSON.parse(raw)).toMatchObject({
      format: 'stargazer-import-corrections',
      version: 2,
      learnedIcons: { v: 1, icons: [] },
      shots: [
        {
          source: {
            name: 'sample.png',
            size: 11,
            sha256: createHash('sha256').update('image bytes').digest('hex'),
          },
          context: { season: 0, mapCount: 5, imageWidth: 1150 },
          predicted: { sides: { 1: [{ candidates: [{ characterId: 5 }] }] } },
          labels: {
            cells: { '1:0': { characterId: 7, paragon: 0 } },
            artifacts: { 1: null },
            mapIndex: 0,
            winner: 1,
          },
        },
      ],
    })
    expect(JSON.parse(raw)).toHaveProperty('shots.0.labels.cells.1:0', {
      characterId: 7,
      paragon: 0,
    })
    expect(raw).not.toContain('untouched.png')
    expect(raw).not.toContain('"card"')
    expect(JSON.parse(raw)).not.toHaveProperty('shots.0.predicted.sides.1.0.descriptor')
    expect(fetchImage).toHaveBeenCalledExactlyOnceWith('blob:sample')
  })

  it('exports only loaded screenshots without retaining an archive', async () => {
    const api = useTeamImport(() => '5v5')
    api.shots.value = [shot()]
    api.setArtifact('sample', 1, 9)
    api.clearShots()
    expect(api.hasCorrections.value).toBe(false)
    expect(JSON.parse(await api.exportCorrections())).toHaveProperty('shots', [])
  })

  it('fails the download if an original image cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )
    const api = useTeamImport(() => '5v5')
    api.shots.value = [shot()]
    api.setArtifact('sample', 1, 9)
    await expect(api.exportCorrections()).rejects.toThrow('Screenshot unavailable')
  })

  it('exports saved hero descriptors after their screenshots are cleared', async () => {
    const fetchImage = vi.fn()
    vi.stubGlobal('fetch', fetchImage)
    const api = useTeamImport(() => '5v5')
    const sample = shot()
    const cell = sample.reading!.sides[1][0]!
    cell.sure = false
    cell.descriptor = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
    api.shots.value = [sample]
    api.setHero('sample', 1, 0, 7)
    api.clearShots()

    expect(api.learnedCount.value).toBe(1)
    expect(api.hasCorrections.value).toBe(true)
    const pending = api.exportCorrections()
    api.forgetLearned()
    const exported = JSON.parse(await pending) as { shots: unknown[]; learnedIcons: unknown }
    expect(exported.shots).toEqual([])
    expect(readLearnedIcons(exported.learnedIcons)).toEqual([
      { characterId: 7, descriptor: encodeLearned(cell.descriptor), learnedAt: expect.any(Number) },
    ])
    expect(fetchImage).not.toHaveBeenCalled()
    expect(api.hasCorrections.value).toBe(false)
    expect(JSON.parse(await api.exportCorrections())).toHaveProperty('learnedIcons.icons', [])
  })
})
