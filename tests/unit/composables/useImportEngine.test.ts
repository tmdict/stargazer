import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImportEngine, type EngineShot, type Intake } from '@/composables/useImportEngine'
import { FRAME_NAMES } from '@/lib/import/card/frames'
import type { ImportKind, ReferencePart } from '@/lib/import/kinds'
import type { ScreenshotReading } from '@/lib/import/screens/match/types'
import type { RosterReading } from '@/lib/import/screens/roster/types'
import { bitmap, FakeWorker, file, readers, stubImportBrowser } from '../fixtures/importBrowser'

vi.mock('@/stores/gameData', () => ({
  useGameDataStore: () => ({ characters: [], artifacts: [], phantimals: [] }),
}))
vi.mock('@/utils/dataLoader', () => ({
  loadMatcherPortraits: () => ({}),
  loadOutfitPortraits: () => ({}),
  loadImportFrames: () =>
    Object.fromEntries(FRAME_NAMES.map((name) => [name, async () => `frame-${name}.webp`])),
}))

beforeEach(stubImportBrowser)

let scope: EffectScope | null = null
afterEach(() => {
  scope?.stop()
  scope = null
  vi.unstubAllGlobals()
})

const reading = {} as ScreenshotReading
const rosterReading = { grid: null, slots: [] } as RosterReading

let ids = 0
// An import holding the engine for its shots, as its modal does while mounted.
// `add` adds files as the sorter places them, else as the import's first kind;
// `opening.open` stands for the import's modal staying open.
const holdEngine = (kinds: readonly ImportKind[] = ['result', 'formation', 'replay']) => {
  const shots: EngineShot[] = []
  const applied: string[] = []
  const opening = { open: true }
  scope ??= effectScope()
  const engine = scope.run(() =>
    useImportEngine({ kinds, shots: () => shots, apply: (id) => applied.push(id) }),
  )!
  const add = (
    files: File[],
    place: Intake<ImportKind, EngineShot>['place'] = (sorted) => ({ kind: sorted ?? kinds[0]! }),
  ) =>
    engine.addFiles(files, {
      current: () => opening.open,
      replay: () => false,
      place,
      add: (added, kind) => {
        const shot: EngineShot = {
          id: `shot-${++ids}`,
          kind,
          name: added.name,
          size: added.size,
          status: 'waiting',
          error: null,
        }
        shots.push(shot)
        return shot
      },
    })
  return { engine, shots, applied, opening, add }
}

// The given parts fetched and handed to a reader, the newest by default, which
// then has to answer.
const partsPosted = async (
  parts: readonly ReferencePart[] = ['heroes', 'match'],
  worker = (): FakeWorker | undefined => readers().at(-1),
): Promise<FakeWorker> => {
  await vi.waitFor(() =>
    expect(parts.every((p) => worker()?.received.some((m) => m.type === p))).toBe(true),
  )
  return worker()!
}

// The reader holds every part it was given.
const answerReady = (worker: FakeWorker, parts: readonly ReferencePart[] = ['heroes', 'match']) => {
  for (const part of parts) worker.reply({ type: 'ready', part })
}

describe('import engine', () => {
  it('reads the waiting shots one at a time once the references are in', async () => {
    const { shots, applied, add } = holdEngine()
    await add([file('a.png')])
    const worker = await partsPosted()
    expect(worker.reads()).toEqual([])

    answerReady(worker)
    await add([file('b.png')])
    const [a, b] = shots
    expect(worker.reads()).toEqual([a!.id])
    expect([a!.status, b!.status]).toEqual(['reading', 'waiting'])
    worker.reply({ type: 'reading', id: a!.id, reading })
    expect([a!.status, b!.status]).toEqual(['ready', 'reading'])
    expect(applied).toEqual([a!.id])
    expect(worker.reads()).toEqual([a!.id, b!.id])
  })

  it('fails the unread shots when the references fail, and reads them once the next load is in', async () => {
    const { shots, add } = holdEngine()
    await add([file('a.png'), file('b.png')])
    const first = await partsPosted()
    first.reply({ type: 'error', id: null, part: 'heroes', message: 'out of memory' })
    expect(shots.map((s) => s.status)).toEqual(['failed', 'failed'])

    await add([file('c.png')])
    const next = await partsPosted()
    answerReady(next)
    expect(shots.map((s) => s.status)).toEqual(['reading', 'waiting', 'waiting'])
    expect(next.reads()).toEqual([shots[0]!.id])
  })

  it('places each file as its import says, skips one added again, and counts what it turns away', async () => {
    const { engine, shots, add } = holdEngine()
    const refuseRosters: Intake<ImportKind, EngineShot>['place'] = (sorted) =>
      sorted === 'roster' ? { refused: 'roster' } : { kind: 'result' }
    FakeWorker.sortAs = 'roster'
    expect(await add([file('a.png'), file('b.png', 2)], refuseRosters)).toEqual({
      added: 0,
      refused: { roster: 2 },
    })
    FakeWorker.sortAs = null
    expect(await add([file('a.png'), file('c.png')], refuseRosters)).toEqual({
      added: 2,
      refused: {},
    })
    // The same name at another size is another file.
    expect(await add([file('c.png'), file('c.png', 3)], refuseRosters)).toEqual({
      added: 1,
      refused: {},
    })
    expect(shots.map((s) => `${s.name}:${s.size}`)).toEqual(['a.png:1', 'c.png:1', 'c.png:3'])
    // Every file is placed, so only the three shots, still waiting on their
    // references, count.
    expect(engine.progress.value).toEqual({ read: 0, total: 3 })
  })

  it('counts the files still being added, and adds none once the opening ends', async () => {
    const { engine, shots, opening, add } = holdEngine()
    // The first file's sort waits on its decode.
    let decoded: () => void = () => {}
    vi.mocked(createImageBitmap).mockImplementationOnce(
      () => new Promise<ImageBitmap>((resolve) => (decoded = () => resolve(bitmap as ImageBitmap))),
    )
    const adding = add([file('a.png'), file('b.png')])
    expect(engine.progress.value).toEqual({ read: 0, total: 2 })
    opening.open = false
    decoded()
    expect(await adding).toEqual({ added: 0, refused: {} })
    expect(shots).toEqual([])
    expect(engine.progress.value).toBeNull()
  })

  it('never reads a shot its import let go of', async () => {
    const { engine, shots, applied, add } = holdEngine()
    await add([file('a.png'), file('b.png'), file('c.png')])
    const worker = await partsPosted()
    answerReady(worker)
    const [a, b, c] = shots

    // a is being read; b is dropped while it waits, a while it is read.
    engine.dropShot(b!.id)
    shots.splice(0, 2)
    worker.reply({ type: 'reading', id: a!.id, reading })
    expect(applied).toEqual([])
    expect(worker.reads()).toEqual([a!.id, c!.id])
  })

  it('leaves nothing of a page visit for the next', async () => {
    const first = holdEngine()
    await first.add([file('a.png')])
    const worker = await partsPosted()
    answerReady(worker)
    // The page is left with a in the worker and `late` still decoding.
    let decoded: () => void = () => {}
    vi.mocked(createImageBitmap)
      .mockImplementationOnce(async () => bitmap as ImageBitmap)
      .mockImplementationOnce(
        () =>
          new Promise<ImageBitmap>((resolve) => (decoded = () => resolve(bitmap as ImageBitmap))),
      )
    const adding = first.add([file('late.png')])
    await vi.waitFor(() => expect(first.shots).toHaveLength(2))
    scope!.stop()
    scope = null
    expect(worker.terminated).toBe(true)
    expect(first.engine.referenceStatus.value).toBe('idle')
    decoded()
    await adding

    const next = holdEngine()
    await next.add([file('next.png')])
    const second = await partsPosted()
    answerReady(second)
    expect(second).not.toBe(worker)
    expect(second.reads()).toEqual([next.shots[0]!.id])
  })

  it('keeps no references fetched for a page left while they loaded', async () => {
    const respond = vi.mocked(fetch).getMockImplementation()!
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    vi.mocked(fetch).mockImplementation(async (...args) => {
      await held
      return respond(...args)
    })
    const first = holdEngine(['roster'])
    const loading = first.engine.ensureReferences()
    scope!.stop()
    scope = null
    release()
    await loading

    // The next visit's reader gets the hero part its own fetch brought, once.
    vi.mocked(fetch).mockImplementation(respond)
    const next = holdEngine(['roster'])
    await next.engine.ensureReferences()
    const reader = readers().at(-1)!
    expect(reader.received.filter((m) => m.type === 'heroes')).toHaveLength(1)
  })

  it('reads a roster with the hero part alone, and a match screen once both parts are in', async () => {
    const match = holdEngine()
    const rosters = holdEngine(['roster'])
    await rosters.add([file('roster.png')])
    const worker = await partsPosted(['heroes'])
    expect(worker.received.some((m) => m.type === 'match')).toBe(false)
    answerReady(worker, ['heroes'])
    const [roster] = rosters.shots
    expect(worker.reads()).toEqual([roster!.id])
    expect(rosters.engine.referenceStatus.value).toBe('ready')

    await match.add([file('team.png')])
    const [team] = match.shots
    worker.reply({ type: 'reading', id: roster!.id, reading: rosterReading })
    expect(match.engine.referenceStatus.value).toBe('loading')
    expect(worker.reads()).toEqual([roster!.id])
    await partsPosted(['match'], () => worker)
    answerReady(worker, ['match'])
    expect(worker.reads()).toEqual([roster!.id, team!.id])
    expect([rosters.applied, match.applied]).toEqual([[roster!.id], []])
  })

  it('starts more readers for a roster while every one is busy, up to the pool', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    const { add } = holdEngine(['roster'])
    await add([1, 2, 3, 4, 5].map((n) => file(`${n}.png`)))
    answerReady(await partsPosted(['heroes']), ['heroes'])
    // Each new reader gets its own copy of the hero part and reads once it holds it.
    for (const reader of [1, 2]) {
      const started = await partsPosted(['heroes'], () => readers()[reader])
      answerReady(started, ['heroes'])
    }
    expect(readers().map((w) => w.reads().length)).toEqual([1, 1, 1])
    const frames = readers().map((w) => {
      const heroes = w.received.find((m) => m.type === 'heroes')
      return heroes?.type === 'heroes' ? heroes.frames[0]!.data : null
    })
    expect(new Set(frames).size).toBe(3)
  })

  it('reads with two readers at most on a touch screen that reports no memory', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }))
    const { add } = holdEngine(['roster'])
    await add([1, 2, 3, 4].map((n) => file(`${n}.png`)))
    answerReady(await partsPosted(['heroes']), ['heroes'])
    answerReady(await partsPosted(['heroes'], () => readers()[1]), ['heroes'])
    expect(readers().map((w) => w.reads().length)).toEqual([1, 1])
  })

  it('drops a reader whose tables fail while another holds them, and grows the pool no further', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    const { engine, shots, add } = holdEngine(['roster'])
    await add([1, 2, 3, 4].map((n) => file(`${n}.png`)))
    const first = await partsPosted(['heroes'])
    answerReady(first, ['heroes'])
    const second = await partsPosted(['heroes'], () => readers()[1])
    second.reply({ type: 'error', id: null, part: 'heroes', message: 'out of memory' })
    expect(second.terminated).toBe(true)
    expect(engine.referenceStatus.value).toBe('ready')

    first.reply({ type: 'reading', id: shots[0]!.id, reading: rosterReading })
    expect(readers().filter((w) => !w.terminated)).toEqual([first])
    expect(first.reads()).toEqual([shots[0]!.id, shots[1]!.id])
    expect(shots.map((s) => s.status)).toEqual(['ready', 'reading', 'waiting', 'waiting'])
  })
})
