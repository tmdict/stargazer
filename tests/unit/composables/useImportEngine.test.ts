import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImportEngine, type EngineShot } from '@/composables/useImportEngine'
import type { ImportKind, ReferencePart } from '@/lib/import/kinds'
import type { ScreenshotReading } from '@/lib/import/screens/match/types'
import type { RosterReading } from '@/lib/import/screens/roster/types'
import type { ImportRequest, ImportResponse } from '@/workers/import.worker'

vi.mock('@/stores/gameData', () => ({
  useGameDataStore: () => ({ characters: [], artifacts: [], phantimals: [] }),
}))
vi.mock('@/utils/dataLoader', () => ({ loadMatcherPortraits: () => ({}) }))

// The browser's side of the engine: a worker that answers when told to, and
// images that decode to blank pixels, each when its bitmap resolves.
class FakeWorker {
  static started: FakeWorker[] = []
  received: ImportRequest[] = []
  terminated = false
  onmessage: ((event: { data: ImportResponse }) => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    FakeWorker.started.push(this)
  }
  postMessage(message: ImportRequest): void {
    this.received.push(message)
  }
  terminate(): void {
    this.terminated = true
  }
  reply(message: ImportResponse): void {
    this.onmessage?.({ data: message })
  }
  reads(): string[] {
    return this.received.flatMap((m) => (m.type === 'read' ? [m.id] : []))
  }
}

const bitmap = { width: 800, height: 600, close: () => {} }
const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  }),
}

beforeEach(() => {
  FakeWorker.started = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('document', { createElement: () => canvas })
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap),
  )
  // No costume manifest; every other reference is an image.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: !url.endsWith('skins.json'),
      status: 404,
      blob: async () => new Blob(),
    })),
  )
})

let scope: EffectScope | null = null
afterEach(() => {
  scope?.stop()
  scope = null
  vi.unstubAllGlobals()
})

let ids = 0
const shot = (kind: ImportKind = 'result'): EngineShot => ({
  id: `shot-${++ids}`,
  kind,
  name: 'shot.png',
  status: 'reading',
  error: null,
})

const reading = {} as ScreenshotReading
const rosterReading = { grid: null, slots: [] } as RosterReading

// An import holding the engine for its shots, as its modal does while mounted:
// the team import reads with both parts of the references, the roster import
// with the hero part alone.
const holdEngine = (shots: EngineShot[], parts: readonly ReferencePart[] = ['heroes', 'match']) => {
  const applied: string[] = []
  scope ??= effectScope()
  const engine = scope.run(() =>
    useImportEngine({ parts, shots: () => shots, apply: (id) => applied.push(id) }),
  )!
  return { engine, applied }
}

// The given parts fetched and handed to a worker, the newest by default,
// which then has to answer.
const partsPosted = async (
  parts: readonly ReferencePart[] = ['heroes', 'match'],
  worker = (): FakeWorker | undefined => FakeWorker.started.at(-1),
): Promise<FakeWorker> => {
  await vi.waitFor(() =>
    expect(parts.every((p) => worker()?.received.some((m) => m.type === p))).toBe(true),
  )
  return worker()!
}

// The worker holds every part it was given.
const answerReady = (worker: FakeWorker, parts: readonly ReferencePart[] = ['heroes', 'match']) => {
  for (const part of parts) worker.reply({ type: 'ready', part })
}

describe('import engine', () => {
  it('reads the waiting shots one at a time once the references are in', async () => {
    const a = shot()
    const b = shot()
    const { engine, applied } = holdEngine([a, b])
    void engine.ensureReferences()
    await engine.readShot(a, new Blob())
    const worker = await partsPosted()
    expect(worker.reads()).toEqual([])

    answerReady(worker)
    await engine.readShot(b, new Blob())
    expect(worker.reads()).toEqual([a.id])
    worker.reply({ type: 'reading', id: a.id, reading })
    expect([a.status, b.status]).toEqual(['ready', 'reading'])
    expect(applied).toEqual([a.id])
    expect(worker.reads()).toEqual([a.id, b.id])
  })

  it('never reads a shot its import let go of', async () => {
    const a = shot()
    const b = shot()
    const c = shot()
    const shots = [a, b, c]
    const { engine, applied } = holdEngine(shots)
    void engine.ensureReferences()
    for (const s of shots) await engine.readShot(s, new Blob())
    const worker = await partsPosted()
    answerReady(worker)

    // a is being read; b is dropped while it waits, a while it is read.
    engine.dropShot(b.id)
    shots.splice(0, 2)
    worker.reply({ type: 'reading', id: a.id, reading })
    expect(applied).toEqual([])
    expect(worker.reads()).toEqual([a.id, c.id])
  })

  it('leaves nothing of a page visit for the next', async () => {
    const a = shot()
    const late = shot()
    const shots = [a, late]
    const { engine } = holdEngine(shots)
    void engine.ensureReferences()
    await engine.readShot(a, new Blob())
    const first = await partsPosted()
    answerReady(first)
    // The page is left with a in the worker and `late` still decoding.
    let decoded: (value: typeof bitmap) => void = () => {}
    vi.mocked(createImageBitmap).mockImplementationOnce(
      () => new Promise<ImageBitmap>((resolve) => (decoded = resolve as typeof decoded)),
    )
    const decoding = engine.readShot(late, new Blob())
    scope!.stop()
    scope = null
    expect(first.terminated).toBe(true)
    expect(engine.referenceStatus.value).toBe('idle')
    decoded(bitmap)
    await decoding

    const next = shot()
    const visit = holdEngine([...shots, next])
    void visit.engine.ensureReferences()
    await visit.engine.readShot(next, new Blob())
    const second = await partsPosted()
    answerReady(second)
    expect(second).not.toBe(first)
    expect(second.reads()).toEqual([next.id])
  })

  it('reads a roster with the hero part alone, and a match screen once both parts are in', async () => {
    const team = shot()
    const roster = shot('roster')
    const match = holdEngine([team])
    const rosters = holdEngine([roster], ['heroes'])
    void rosters.engine.ensureReferences()
    await rosters.engine.readShot(roster, new Blob())
    const worker = await partsPosted(['heroes'])
    expect(worker.received.some((m) => m.type === 'match')).toBe(false)
    answerReady(worker, ['heroes'])
    expect(worker.reads()).toEqual([roster.id])
    expect(rosters.engine.referenceStatus.value).toBe('ready')

    void match.engine.ensureReferences()
    await match.engine.readShot(team, new Blob())
    worker.reply({ type: 'reading', id: roster.id, reading: rosterReading })
    expect(match.engine.referenceStatus.value).toBe('loading')
    expect(worker.reads()).toEqual([roster.id])
    await partsPosted(['match'], () => worker)
    answerReady(worker, ['match'])
    expect(worker.reads()).toEqual([roster.id, team.id])
    expect([rosters.applied, match.applied]).toEqual([[roster.id], []])
  })

  it('starts more readers for a roster while every one is busy, up to the pool', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    const shots = [1, 2, 3, 4, 5].map(() => shot('roster'))
    const { engine } = holdEngine(shots, ['heroes'])
    void engine.ensureReferences()
    for (const s of shots) await engine.readShot(s, new Blob())
    answerReady(await partsPosted(['heroes']), ['heroes'])
    // Each new reader gets its own copy of the hero part and reads once it holds it.
    for (const reader of [1, 2]) {
      const started = await partsPosted(['heroes'], () => FakeWorker.started[reader])
      answerReady(started, ['heroes'])
    }
    expect(FakeWorker.started.map((w) => w.reads().length)).toEqual([1, 1, 1])
    const frames = FakeWorker.started.map((w) => {
      const heroes = w.received.find((m) => m.type === 'heroes')
      return heroes?.type === 'heroes' ? heroes.frames[0]!.data : null
    })
    expect(new Set(frames).size).toBe(3)
  })
})
