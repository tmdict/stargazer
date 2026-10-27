/* The Supreme League worker for the visit (workers/sl.worker.ts): started
 * when a page that needs it mounts and kept until the tab reloads, so a visit
 * that opens more than one such page loads the file and learns the model
 * once. A worker that fails is dropped, and the next page to mount starts
 * another. */

import { onMounted, readonly, ref } from 'vue'

import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import type { SlRequest, SlResponse } from '@/workers/sl.worker'

export type SlEngineStatus = 'loading' | 'ready' | 'failed'

const status = ref<SlEngineStatus>('loading')
let worker: Worker | null = null
let nextId = 0
const waiting = new Map<number, { resolve: (set: SlChoice | null) => void; reject: () => void }>()

const fail = (): void => {
  status.value = 'failed'
  worker?.terminate()
  worker = null
  for (const { reject } of waiting.values()) reject()
  waiting.clear()
}

const start = (): void => {
  if (worker) return
  status.value = 'loading'
  worker = new Worker(new URL('../workers/sl.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<SlResponse>) => {
    const msg = event.data
    if (msg.type === 'ready') status.value = 'ready'
    else if (msg.type === 'failed') fail()
    else {
      const answer = waiting.get(msg.id)
      waiting.delete(msg.id)
      if (msg.type === 'generated') answer?.resolve(msg.set)
      else answer?.reject()
    }
  }
  worker.onerror = fail
}

export function useSlEngine() {
  onMounted(start)

  // Rejects when the worker cannot answer.
  const generate = (picks: SlPick[]): Promise<SlChoice | null> =>
    new Promise((resolve, reject) => {
      if (!worker) return reject()
      const id = nextId++
      waiting.set(id, { resolve, reject })
      const message: SlRequest = { type: 'generate', id, picks }
      worker.postMessage(message)
    })

  return { status: readonly(status), generate }
}
