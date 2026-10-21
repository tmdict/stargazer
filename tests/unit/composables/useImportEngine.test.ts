import { effectScope, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useImportEngine, type EngineShot } from '@/composables/useImportEngine'
import type { ScreenshotReading } from '@/lib/import/screens/match/types'
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
const shot = (): EngineShot => ({
  id: `shot-${++ids}`,
  kind: 'result',
  name: 'shot.png',
  status: 'reading',
  error: null,
})

const reading = {} as ScreenshotReading

// An import holding the engine for its shots, as its modal does while mounted.
const holdEngine = (shots: EngineShot[]) => {
  const applied: string[] = []
  scope ??= effectScope()
  const engine = scope.run(() =>
    useImportEngine({ shots: () => shots, apply: (id) => applied.push(id) }),
  )!
  return { engine, applied }
}

// The references fetched and handed to the newest worker, which then has to answer.
const referencesPosted = async (): Promise<FakeWorker> => {
  await vi.waitFor(() =>
    expect(FakeWorker.started.at(-1)?.received.some((m) => m.type === 'references')).toBe(true),
  )
  return FakeWorker.started.at(-1)!
}

describe('import engine', () => {
  it('reads the waiting shots one at a time once the references are in', async () => {
    const a = shot()
    const b = shot()
    const { engine, applied } = holdEngine([a, b])
    void engine.ensureReferences()
    await engine.readShot(a, new Blob())
    const worker = await referencesPosted()
    expect(worker.reads()).toEqual([])

    worker.reply({ type: 'ready' })
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
    const worker = await referencesPosted()
    worker.reply({ type: 'ready' })

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
    const first = await referencesPosted()
    first.reply({ type: 'ready' })
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
    const second = await referencesPosted()
    second.reply({ type: 'ready' })
    expect(second).not.toBe(first)
    expect(second.reads()).toEqual([next.id])
  })
})
