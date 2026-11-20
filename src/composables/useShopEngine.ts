/* The Honor Duel shop worker (workers/shop.worker.ts): started when the
 * calculator page mounts and kept until it is left, so a later request finds
 * the tables an earlier one filled. A request is ended by telling the worker
 * to stop, or by sending the next one; the worker drops the old one at its
 * next pause and keeps its tables. Only the newest request's answers are
 * shown: each carries its request's number, and one from an earlier request
 * is dropped. */

import { onMounted, onUnmounted, readonly, ref, shallowReadonly, shallowRef } from 'vue'

import type { ShopRequest, ShopResult } from '@/lib/hd/shop/calculate'
import type { ShopWorkerRequest, ShopWorkerResponse } from '@/workers/shop.worker'

let worker: Worker | null = null
let nextId = 0
// The request still being answered, with where its answers go.
let active: { id: number; take: (response: ShopWorkerResponse | null) => void } | null = null

const endWorker = (): void => {
  if (worker) worker.onmessage = worker.onerror = null
  worker?.terminate()
  worker = null
}

const start = (): Worker => {
  if (worker) return worker
  const started = new Worker(new URL('../workers/shop.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = (event: MessageEvent<ShopWorkerResponse>) => {
    if (event.data.id === active?.id) active.take(event.data)
  }
  started.onerror = () => {
    endWorker()
    active?.take(null)
  }
  worker = started
  return started
}

export function useShopEngine() {
  // The newest request's answers as they stand, null before any arrive.
  const result = shallowRef<ShopResult | null>(null)
  const working = ref(false)
  const failed = ref(false)

  // Ends the request at work, keeping the answers it has given.
  const cancel = (): void => {
    if (!working.value) return
    working.value = false
    active = null
    worker?.postMessage({ type: 'stop' } satisfies ShopWorkerRequest)
  }

  // For a change to what was entered: the answers shown no longer belong to it.
  const clear = (): void => {
    cancel()
    result.value = null
    failed.value = false
  }

  const calculate = (request: ShopRequest): void => {
    result.value = null
    failed.value = false
    const id = nextId++
    working.value = true
    active = {
      id,
      take: (response) => {
        if (response?.type === 'answer') {
          result.value = response.result
          if (response.result.settled) {
            working.value = false
            active = null
          }
        } else {
          failed.value = true
          working.value = false
          active = null
        }
      },
    }
    // A worker that cannot start, or a request it cannot be sent, ends as a
    // failure the page shows.
    try {
      start().postMessage({ type: 'calculate', id, request } satisfies ShopWorkerRequest)
    } catch {
      active.take(null)
    }
  }

  onMounted(start)
  // The tables go with the worker: nothing entered outlasts the page either.
  onUnmounted(() => {
    clear()
    endWorker()
  })

  return {
    result: shallowReadonly(result),
    working: readonly(working),
    failed: readonly(failed),
    calculate,
    cancel,
    clear,
  }
}
