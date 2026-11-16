/* Honor Duel shop worker: answers the shop calculator's requests, so the
 * search does not hold up the page. A request's answers come in stages, each
 * a whole set that replaces the last (lib/hd/shop/calculate.ts). The worker
 * hears nothing while it works, so it stops at every pause of the calculation
 * to take in what the page has sent, and drops a request the page no longer
 * wants. Its tables are kept from one request to the next, a dropped one
 * included.
 *
 * This is the one place that chooses the odds: the data pack's table when the
 * pack has one, else the measured table in this repo. */

import { calculateShop, type ShopRequest, type ShopResult } from '@/lib/hd/shop/calculate'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import { checkOdds } from '@/lib/hd/shop/odds'
import { createSolverCache } from '@/lib/hd/shop/solverCache'
import type { OddsTable } from '@/lib/hd/shop/types'

export type ShopWorkerRequest =
  /** `stop` ends the request at work and starts none. */
  { type: 'calculate'; id: number; request: ShopRequest } | { type: 'stop' }

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
const table = packed ? checkOdds(packed, SHOP_FACTS) : MEASURED_ODDS
const cache = createSolverCache()

// A turn of the event loop, in which a message from the page is taken in. A
// timer would do, but a browser holds a timer set from a timer back by four
// milliseconds. A dropped request and the one that replaced it can both be
// waiting here, so each waits with a listener of its own.
const turn = new MessageChannel()
turn.port1.start()
const heard = (): Promise<void> =>
  new Promise((resolve) => {
    turn.port1.addEventListener('message', () => resolve(), { once: true })
    turn.port2.postMessage(null)
  })

// The request the page wants answered, or -1 for none.
let wanted = -1

async function answer(id: number, request: ShopRequest): Promise<void> {
  try {
    for (const result of calculateShop(request, table, SHOP_FACTS, cache)) {
      if (result) scope.postMessage({ type: 'answer', id, result })
      await heard()
      if (wanted !== id) return
    }
  } catch {
    scope.postMessage({ type: 'error', id })
  }
}

scope.addEventListener('message', ({ data }) => {
  if (data.type === 'stop') {
    wanted = -1
    return
  }
  wanted = data.id
  void answer(data.id, data.request)
})
