import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CORRECTIONS_CAP,
  disposeTeamImport,
  shotMapIndex,
  shotWinner,
  useTeamImport,
  type ImportShot,
} from '@/composables/useTeamImport'
import { DESCRIPTOR_LENGTH, encodeLearned } from '@/lib/import/heroes'
import { readLearnedIcons } from '@/lib/import/learned'
import { stubLocalStorage } from '../fixtures/storage'

vi.mock('@/stores/gameData', () => ({ useGameDataStore: vi.fn() }))
vi.mock('@/utils/dataLoader', () => ({
  loadMatcherPortraits: vi.fn(),
  loadArtifacts: () => [],
  loadPhantimals: () => [],
}))

const SHA = createHash('sha256').update('image bytes').digest('hex')

const shot = (): ImportShot => ({
  id: 'sample',
  kind: 'result',
  name: 'sample.png',
  size: 11,
  sha256: SHA,
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
  const api = useTeamImport(() => '5v5')
  api.forgetLearned()
  api.clearCorrections()
  disposeTeamImport()
  vi.unstubAllEnvs()
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
    expect(board.sides[2]!.mains.map((unit) => unit.unitId)).toEqual([5])
    expect(board.sides[2]!.artifact).toBe(8)
    expect(board.sides[1]).toEqual({ mains: [], companions: [], phantimal: null, artifact: null })
    expect(api.hasCorrections.value).toBe(false)
    expect(api.exportCorrections()).not.toContain('swap')
    api.clearImport()
    expect(api.swapSides.value).toBe(false)
  })
})

describe('clearing an import', () => {
  it('drops unsaved name edits back to the names last saved', () => {
    vi.stubEnv('SSR', false)
    stubLocalStorage()
    const api = useTeamImport(() => '5v5')
    api.names.left = 'unii'
    api.saveNames()
    api.names.left = 'typo'
    api.names.right = 'BTrickz'
    api.clearImport()
    expect(api.names.left).toBe('unii')
    expect(api.names.right).toBe('')
  })
})

describe('download import corrections', () => {
  it('exports explicit labels and original image hashes without pixels or unreviewed guesses as labels', () => {
    const api = useTeamImport(() => '5v5')
    api.shots.value = [shot(), { ...shot(), id: 'untouched', name: 'untouched.png', sha256: 'b' }]
    expect(api.hasCorrections.value).toBe(false)
    api.setHero('sample', 1, 0, 7)
    api.setLevel('sample', 1, 0, 'paragon', 0)
    api.setArtifact('sample', 1, null)
    api.setMap('sample', 0)
    api.setWinner('sample', 1)
    expect(api.hasCorrections.value).toBe(true)

    const raw = api.exportCorrections()
    expect(JSON.parse(raw)).toMatchObject({
      app: 'stargazer',
      kind: 'import-corrections',
      learnedIcons: { icons: [] },
      shots: [
        {
          source: { name: 'sample.png', size: 11, sha256: SHA },
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
  })

  it('keeps corrections past the import, replacing a screenshot corrected again, until cleared', () => {
    vi.stubEnv('SSR', false)
    const { storage } = stubLocalStorage()
    const api = useTeamImport(() => '5v5')
    api.shots.value = [shot()]
    api.setArtifact('sample', 1, 9)
    api.clearImport()
    api.shots.value = [{ ...shot(), id: 'again' }]
    api.setArtifact('again', 1, 4)
    api.clearImport()

    const exported = JSON.parse(api.exportCorrections()) as { shots: { labels: unknown }[] }
    expect(exported.shots.map((s) => s.labels)).toEqual([{ cells: {}, artifacts: { 1: 4 } }])
    expect(JSON.parse(storage.get('stargazer.import.corrections')!)).toMatchObject({
      version: 1,
      shots: [{ source: { sha256: SHA }, labels: { artifacts: { 1: 4 } } }],
    })
    expect(api.correctionCount.value).toBe(1)

    api.clearCorrections()
    expect(api.hasCorrections.value).toBe(false)
    expect(storage.has('stargazer.import.corrections')).toBe(false)
  })

  it('leaves a new screenshot unsaved at the cap, still downloading it while open', () => {
    vi.stubEnv('SSR', false)
    stubLocalStorage()
    const api = useTeamImport(() => '5v5')
    api.shots.value = Array.from({ length: CORRECTIONS_CAP + 1 }, (_, i) => ({
      ...shot(),
      id: `s${i}`,
      sha256: `${i}`,
    }))
    for (const { id } of api.shots.value) api.setArtifact(id, 1, 9)
    expect(api.correctionCount.value).toBe(CORRECTIONS_CAP)
    expect(api.correctionsFull.value).toBe(true)
    expect(JSON.parse(api.exportCorrections()).shots).toHaveLength(CORRECTIONS_CAP + 1)
    api.clearImport()
    expect(JSON.parse(api.exportCorrections()).shots).toHaveLength(CORRECTIONS_CAP)
  })

  it('reads saved corrections back on the next visit, dropping malformed entries', async () => {
    vi.stubEnv('SSR', false)
    const { storage } = stubLocalStorage()
    const saved = {
      source: { name: 'kept.png', size: 3, sha256: 'a' },
      context: { season: 8, mapCount: 5, imageWidth: 1150 },
      predicted: { sides: {} },
      labels: { cells: {}, artifacts: { 1: 2 } },
    }
    storage.set(
      'stargazer.import.corrections',
      JSON.stringify({ version: 1, shots: [saved, { source: { name: 'broken.png' } }] }),
    )
    vi.resetModules()
    const fresh = await import('@/composables/useTeamImport')
    const api = fresh.useTeamImport(() => '5v5')
    expect(JSON.parse(api.exportCorrections()).shots).toEqual([saved])
    api.clearCorrections()
  })

  it('exports saved hero descriptors after their screenshots are cleared', () => {
    const api = useTeamImport(() => '5v5')
    const sample = shot()
    const cell = sample.reading!.sides[1][0]!
    cell.sure = false
    cell.descriptor = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
    api.shots.value = [sample]
    api.setHero('sample', 1, 0, 7)
    api.clearImport()
    api.clearCorrections()

    expect(api.learnedCount.value).toBe(1)
    expect(api.hasCorrections.value).toBe(true)
    const exported = JSON.parse(api.exportCorrections()) as { learnedIcons: unknown }
    expect(readLearnedIcons(exported.learnedIcons)).toEqual([
      { characterId: 7, descriptor: encodeLearned(cell.descriptor), learnedAt: expect.any(Number) },
    ])
    api.forgetLearned()
    expect(api.hasCorrections.value).toBe(false)
    expect(JSON.parse(api.exportCorrections())).toHaveProperty('learnedIcons.icons', [])
  })
})
