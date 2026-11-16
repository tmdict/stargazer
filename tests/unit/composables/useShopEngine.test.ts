import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { useShopEngine } from '@/composables/useShopEngine'
import type { ShopRequest, ShopResult } from '@/lib/hd/shop/calculate'
import type { ShopWorkerRequest, ShopWorkerResponse } from '@/workers/shop.worker'

// Vitest has no worker thread for the app's worker, so this one stands in for
// it: it records what it is sent and answers when the test says so. Unlike a
// real one it can still answer after it is ended, the hardest case for the page.
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

  answer(id: number, result: ShopResult): void {
    this.onmessage?.({ data: { type: 'answer', id, result } } as MessageEvent<ShopWorkerResponse>)
  }
}

const newest = (): FakeWorker => FakeWorker.started.at(-1)!
const request = {} as ShopRequest
const stage = (settled: boolean): ShopResult => ({ answers: [], settled })

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
    const { id } = worker.received[0]!
    worker.answer(id, stage(false))
    expect(engine.result.value).toEqual(stage(false))
    expect(engine.working.value).toBe(true)
    worker.answer(id, stage(true))
    expect(engine.result.value).toEqual(stage(true))
    expect(engine.working.value).toBe(false)
    // A worker that has finished is kept, with its tables, for the next request.
    engine.calculate(request)
    expect(newest()).toBe(worker)
  })

  it('never shows an answer to what was entered before a change', () => {
    const engine = open()
    engine.calculate(request)
    const first = newest()
    const old = first.received[0]!.id
    first.answer(old, stage(false))

    engine.clear()
    expect(engine.result.value).toBeNull()
    expect(first.ended).toBe(true)
    first.answer(old, stage(true))
    expect(engine.result.value).toBeNull()

    engine.calculate(request)
    const second = newest()
    expect(second).not.toBe(first)
    second.answer(old, stage(true))
    expect(engine.result.value).toBeNull()
    second.answer(second.received[0]!.id, stage(true))
    expect(engine.result.value).toEqual(stage(true))
  })

  it('keeps the answers it has when a request is cancelled', () => {
    const engine = open()
    engine.calculate(request)
    const worker = newest()
    const { id } = worker.received[0]!
    worker.answer(id, stage(false))

    engine.cancel()
    expect(worker.ended).toBe(true)
    expect(engine.working.value).toBe(false)
    worker.answer(id, stage(true))
    expect(engine.result.value).toEqual(stage(false))
  })
})
