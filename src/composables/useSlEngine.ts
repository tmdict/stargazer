/* The Supreme League worker for the visit (workers/sl.worker.ts): started
 * when a page that needs it mounts, or by the first request of one that needs
 * it only now and then (Generate, Placement tips), and kept until the tab
 * reloads, so a visit that opens more than one such page reads the file once.
 * A worker that fails is dropped, and the next page to mount or request starts
 * another. Each worker's first press takes the fits kept from earlier visits,
 * and every press's new ones are kept (storedFits.ts). */

import { onMounted, readonly, ref } from 'vue'

import type { AttrRecord } from '@/lib/characters/attributes'
import type { MapLayout } from '@/lib/maps'
import type { PlacementExplanation } from '@/lib/placement/explain'
import type { SlUnit } from '@/lib/pvp/data/types'
import type { BoardDraw, BoardFormation } from '@/lib/pvp/generator/formation'
import type { SlBoard } from '@/lib/pvp/generator/setType'
import {
  FITS_KEY,
  mergeFits,
  parseStoredFits,
  type StoredFits,
} from '@/lib/pvp/generator/storedFits'
import type { SwapPreview, SwapRequest } from '@/lib/pvp/generator/swapPreview'
import type { SlChoice, SlChoiceTeam, SlPick } from '@/lib/pvp/generator/types'
import type { Pair, WwwPanel, WwwTeam } from '@/lib/pvp/www/panel'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import type { SlRequest, SlResponse } from '@/workers/sl.worker'

type SlEngineStatus = 'loading' | 'ready' | 'failed'

const status = ref<SlEngineStatus>('loading')
let worker: Worker | null = null
let seeded = false
let nextId = 0
type Answer = Extract<
  SlResponse,
  {
    type: 'generated' | 'filled' | 'explained' | 'placed' | 'placedEngine' | 'swapped' | 'predicted'
  }
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
  seeded = false
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

const storedFits = (): StoredFits | null => {
  const text = readStorage(FITS_KEY)
  const fits = parseStoredFits(text)
  if (text !== null && !fits) removeStorage(FITS_KEY)
  return fits
}

// The fits for the worker's first press; the worker leaves out those of
// another build.
const seed = (): StoredFits | null => {
  if (seeded) return null
  seeded = true
  return storedFits()
}

// A value from another build is replaced. A save the browser refuses removes
// the value, so it never holds room that saved teams need.
const keep = (gained: StoredFits | null): void => {
  if (!gained) return
  const stored = storedFits()
  const same = stored?.build === gained.build
  if (!Object.keys(gained.maps).length) {
    if (stored && !same) removeStorage(FITS_KEY)
    return
  }
  const maps = mergeFits(same ? stored.maps : {}, gained.maps)
  if (!writeStorage(FITS_KEY, JSON.stringify({ build: gained.build, maps })))
    removeStorage(FITS_KEY)
}

export function useSlEngine({ startOnMount = true } = {}) {
  if (startOnMount) onMounted(start)

  // Rejects when the worker cannot answer.
  const ask = (request: (id: number) => SlRequest): Promise<Answer> =>
    new Promise((resolve, reject) => {
      start()
      if (!worker) return reject()
      const id = nextId++
      waiting.set(id, { resolve, reject })
      worker.postMessage(request(id))
    })

  const generate = async (picks: SlPick[], boards: SlBoard[]): Promise<SlChoice | null> => {
    const answer = await ask((id) => ({ type: 'generate', id, picks, boards, fits: seed() }))
    if (answer.type !== 'generated') throw new Error('The worker answered another request')
    keep(answer.gained)
    return answer.set
  }

  // The set for these boards as a saved team, or null when none can be made;
  // `seasonal` false asks for the Non-Seasonal format's.
  const fill = async (
    levels: Record<string, AttrRecord> | null,
    layouts: MapLayout[],
    seasonal: boolean,
  ): Promise<string | null> => {
    const answer = await ask((id) => ({
      type: 'fill',
      id,
      levels,
      layouts,
      seasonal,
      fits: seed(),
    }))
    if (answer.type !== 'filled') throw new Error('The worker answered another request')
    keep(answer.gained)
    return answer.team
  }

  // Why each unit of a side stands where it does, null for a side the engine
  // cannot explain.
  const explain = async (
    layout: MapLayout,
    units: SlUnit[],
    artifact: number | null,
  ): Promise<PlacementExplanation | null> => {
    const answer = await ask((id) => ({ type: 'explain', id, layout, units, artifact }))
    if (answer.type !== 'explained') throw new Error('The worker answered another request')
    return answer.why
  }

  // Each board of a set as first drawn, and why each unit stands there.
  const place = async (set: SlChoice, boards: SlBoard[]): Promise<BoardDraw[]> => {
    const answer = await ask((id) => ({ type: 'place', id, set, boards }))
    if (answer.type !== 'placed') throw new Error('The worker answered another request')
    return answer.boards
  }

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

  return { status: readonly(status), generate, fill, explain, place, placeEngine, swap, predict }
}
