import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useShopEngine } from '@/composables/useShopEngine'
import type { ShopRequest, ShopResult } from '@/lib/hd/shop/calculate'
import type { ShopWorkerRequest, ShopWorkerResponse } from '@/workers/shop.worker'

// Vitest has no worker thread for the app's worker, so this one stands in for
// it: it records what it is sent and answers when the test says so. It can
// answer a request it was told to stop, as a real one does until its next pause.
class FakeWorker {
  static started: FakeWorker[] = []
  onmessage: ((event: MessageEvent<ShopWorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  received: ShopWorkerRequest[] = []
  ended = false

  constructor() {
    FakeWorker.started.push(this)
  }

  postMessage(message: ShopWorkerRequest): void {
    this.received.push(message)
  }

  terminate(): void {
    this.ended = true
  }

  /** The numbers of the requests it was sent, in order. */
  get asked(): number[] {
    return this.received.flatMap((message) => (message.type === 'calculate' ? [message.id] : []))
  }

  answer(id: number, result: ShopResult): void {
    this.onmessage?.({ data: { type: 'answer', id, result } } as MessageEvent<ShopWorkerResponse>)
  }
}

const newest = (): FakeWorker => FakeWorker.started.at(-1)!
const request = {} as ShopRequest
const stage = (settled: boolean): ShopResult => ({ answers: [], skipped: [], settled })

// The engine keeps its worker for the visit, so each test loads it anew.
let open: typeof useShopEngine
beforeEach(async () => {
  FakeWorker.started = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.resetModules()
  open = (await import('@/composables/useShopEngine')).useShopEngine
})
afterEach(() => vi.unstubAllGlobals())

describe('the shop engine', () => {
  it('shows each stage of the newest request and stops working at the last', () => {
    const engine = open()
    engine.calculate(request)
    const worker = newest()
    const id = worker.asked[0]!
    worker.answer(id, stage(false))
    expect(engine.result.value).toEqual(stage(false))
    expect(engine.working.value).toBe(true)
    worker.answer(id, stage(true))
    expect(engine.result.value).toEqual(stage(true))
    expect(engine.working.value).toBe(false)
  })

  it('never shows an answer to what was entered before a change', () => {
    const engine = open()
    engine.calculate(request)
    const worker = newest()
    const old = worker.asked[0]!
    worker.answer(old, stage(false))

    engine.clear()
    expect(engine.result.value).toBeNull()
    expect(worker.received.at(-1)).toEqual({ type: 'stop' })
    worker.answer(old, stage(true))
    expect(engine.result.value).toBeNull()

    // The worker is kept, with its tables, through the change.
    engine.calculate(request)
    expect(newest()).toBe(worker)
    expect(worker.ended).toBe(false)
    worker.answer(old, stage(true))
    expect(engine.result.value).toBeNull()
    worker.answer(worker.asked[1]!, stage(true))
    expect(engine.result.value).toEqual(stage(true))
  })

  it('answers a request sent while another is at work, and only that one', () => {
    const engine = open()
    engine.calculate(request)
    const worker = newest()
    worker.answer(worker.asked[0]!, stage(false))

    engine.calculate(request)
    expect(engine.result.value).toBeNull()
    expect(engine.working.value).toBe(true)
    worker.answer(worker.asked[0]!, stage(true))
    expect(engine.result.value).toBeNull()
    worker.answer(worker.asked[1]!, stage(true))
    expect(engine.result.value).toEqual(stage(true))
    expect(engine.working.value).toBe(false)
  })

  it('keeps the answers it has when a request is cancelled', () => {
    const engine = open()
    engine.calculate(request)
    const worker = newest()
    const id = worker.asked[0]!
    worker.answer(id, stage(false))

    engine.cancel()
    expect(worker.received.at(-1)).toEqual({ type: 'stop' })
    expect(engine.working.value).toBe(false)
    worker.answer(id, stage(true))
    expect(engine.result.value).toEqual(stage(false))
  })

  it('reports a worker that broke down, and starts another for the next request', () => {
    const engine = open()
    engine.calculate(request)
    const broken = newest()
    broken.onerror?.()
    expect(engine.failed.value).toBe(true)
    expect(engine.working.value).toBe(false)
    expect(broken.ended).toBe(true)

    engine.calculate(request)
    expect(newest()).not.toBe(broken)
    newest().answer(newest().asked[0]!, stage(true))
    expect(engine.result.value).toEqual(stage(true))
  })
})
