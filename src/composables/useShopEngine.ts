/* The Honor Duel shop worker for the visit (workers/shop.worker.ts): started
 * when the calculator page mounts and kept while it only waits, so a later
 * request finds the tables an earlier one filled. A worker at work hears
 * nothing, so a request is ended by ending its worker and starting another.
 * Only the newest request's answers are shown: each carries its request's
 * number, and one from an earlier request is dropped. */

import { onMounted, onUnmounted, readonly, ref, shallowReadonly, shallowRef } from 'vue'

import type { ShopRequest, ShopResult } from '@/lib/hd/shop/calculate'
import type { ShopWorkerRequest, ShopWorkerResponse } from '@/workers/shop.worker'

let worker: Worker | null = null
let nextId = 0
// The request still being answered, with where its answers go.
let active: { id: number; take: (response: ShopWorkerResponse | null) => void } | null = null

const stop = (): void => {
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
    stop()
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

  const end = (): void => {
    if (!working.value) return
    working.value = false
    active = null
    stop()
    start()
  }

  // Ends the request at work, keeping the answers it has given.
  const cancel = end

  // For a change to what was entered: the answers shown no longer belong to it.
  const clear = (): void => {
    end()
    result.value = null
    failed.value = false
  }

  const calculate = (request: ShopRequest): void => {
    clear()
    const id = nextId++
    working.value = true
    active = {
      id,
      take: (response) => {
        if (response?.type === 'answer') {
          result.value = response.result
          if (!('answers' in response.result) || response.result.settled) {
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
    start().postMessage({ id, request } satisfies ShopWorkerRequest)
  }

  onMounted(start)
  onUnmounted(clear)

  return {
    result: shallowReadonly(result),
    working: readonly(working),
    failed: readonly(failed),
    calculate,
    cancel,
    clear,
  }
}
