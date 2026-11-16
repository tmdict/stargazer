/* Honor Duel shop worker: answers the shop calculator's requests, so the
 * search does not hold up the page. A request's answers come in stages, each
 * a whole set that replaces the last (lib/hd/shop/calculate.ts). The worker
 * hears nothing while it works, so the page ends a request by ending the
 * worker. Its tables are kept from one request to the next.
 *
 * This is the one place that chooses the odds: the data pack's table when the
 * pack has one, else the measured table in this repo. */

import defaults from '@/data/hd/shop/odds.json'
import { calculateShop, type ShopRequest, type ShopResult } from '@/lib/hd/shop/calculate'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { checkOdds } from '@/lib/hd/shop/odds'
import { createSolverCache } from '@/lib/hd/shop/solverCache'
import type { OddsTable } from '@/lib/hd/shop/types'

export interface ShopWorkerRequest {
  id: number
  request: ShopRequest
}

export type ShopWorkerResponse =
  { type: 'answer'; id: number; result: ShopResult } | { type: 'error'; id: number }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin.
const scope = self as unknown as {
  postMessage(message: ShopWorkerResponse): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ShopWorkerRequest>) => void,
  ): void
}

const packed = Object.values(
  import.meta.glob<OddsTable>('@/pack/hd/shop/odds.json', { eager: true, import: 'default' }),
)[0]
const table = checkOdds(packed ?? (defaults as OddsTable), SHOP_FACTS)
const cache = createSolverCache()

scope.addEventListener('message', ({ data: { id, request } }) => {
  try {
    for (const result of calculateShop(request, table, SHOP_FACTS, cache)) {
      scope.postMessage({ type: 'answer', id, result })
    }
  } catch {
    scope.postMessage({ type: 'error', id })
  }
})
