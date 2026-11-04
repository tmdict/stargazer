/* The Supreme League worker for the visit (workers/sl.worker.ts): started
 * when a page that needs it mounts and kept until the tab reloads, so a visit
 * that opens more than one such page reads the file once. A worker that fails
 * is dropped, and the next page to mount starts another. */

import { onMounted, readonly, ref } from 'vue'

import type { BoardDraw, BoardFormation } from '@/lib/pvp/sl/generator/formation'
import type { SlBoard } from '@/lib/pvp/sl/generator/setType'
import type { SwapPreview, SwapRequest } from '@/lib/pvp/sl/generator/swapPreview'
import type { SlChoice, SlChoiceTeam, SlPick } from '@/lib/pvp/sl/generator/types'
import type { Pair, WwwPanel, WwwTeam } from '@/lib/pvp/sl/www/panel'
import type { SlRequest, SlResponse } from '@/workers/sl.worker'

type SlEngineStatus = 'loading' | 'ready' | 'failed'

const status = ref<SlEngineStatus>('loading')
let worker: Worker | null = null
let nextId = 0
type Answer = Extract<
  SlResponse,
  { type: 'generated' | 'placed' | 'placedEngine' | 'swapped' | 'predicted' }
>
const waiting = new Map<number, { resolve: (answer: Answer) => void; reject: () => void }>()

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
      if (msg.type === 'error') answer?.reject()
      else answer?.resolve(msg)
    }
  }
  worker.onerror = fail
}

export function useSlEngine() {
  onMounted(start)

  // Rejects when the worker cannot answer.
  const ask = (request: (id: number) => SlRequest): Promise<Answer> =>
    new Promise((resolve, reject) => {
      if (!worker) return reject()
      const id = nextId++
      waiting.set(id, { resolve, reject })
      worker.postMessage(request(id))
    })

  const generate = async (picks: SlPick[], boards: SlBoard[]): Promise<SlChoice | null> => {
    const answer = await ask((id) => ({ type: 'generate', id, picks, boards }))
    if (answer.type !== 'generated') throw new Error('The worker answered another request')
    return answer.set
  }

  // Each board of a set as first drawn, and why each unit stands there.
  const place = async (set: SlChoice, boards: SlBoard[]): Promise<BoardDraw[]> => {
    const answer = await ask((id) => ({ type: 'place', id, set, boards }))
    if (answer.type !== 'placed') throw new Error('The worker answered another request')
    return answer.boards
  }

  // The engine's formation of a chosen team on its board.
  const placeEngine = async (team: SlChoiceTeam, board: SlBoard): Promise<BoardFormation> => {
    const answer = await ask((id) => ({ type: 'placeEngine', id, team, board }))
    if (answer.type !== 'placedEngine') throw new Error('The worker answered another request')
    return answer.formation
  }

  const swap = async (request: SwapRequest): Promise<SwapPreview> => {
    const answer = await ask((id) => ({ type: 'swap', id, swap: request }))
    if (answer.type !== 'swapped') throw new Error('The worker answered another request')
    return answer.preview
  }

  const predict = async (teams: Pair<WwwTeam>): Promise<WwwPanel> => {
    const answer = await ask((id) => ({ type: 'predict', id, teams }))
    if (answer.type !== 'predicted') throw new Error('The worker answered another request')
    return answer.panel
  }

  return { status: readonly(status), generate, place, placeEngine, swap, predict }
}
