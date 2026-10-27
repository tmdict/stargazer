/* Supreme League worker: reads the data file, learns the prediction model
 * once, and answers the generator page, so the search never holds up the
 * page. */

import { loadSlData } from '@/lib/pvp/sl/data/codec'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { learnSeason } from '@/lib/pvp/sl/model/models'
import { artifactSurvives } from '@/lib/seasonal'

export type SlRequest = { type: 'generate'; id: number; picks: SlPick[] }

export type SlResponse =
  | { type: 'ready' }
  | { type: 'failed' }
  | { type: 'generated'; id: number; set: SlChoice | null }
  | { type: 'error'; id: number }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin.
const scope = self as unknown as {
  postMessage(message: SlResponse): void
  addEventListener(type: 'message', listener: (event: MessageEvent<SlRequest>) => void): void
}

const engine = loadSlData().then((data) => ({ data, learned: learnSeason(data) }))

engine.then(
  () => scope.postMessage({ type: 'ready' }),
  () => scope.postMessage({ type: 'failed' }),
)

scope.addEventListener('message', async (event) => {
  const msg = event.data
  try {
    const { data, learned } = await engine
    const set = chooseSlSet(data, learned, msg.picks, (id) => artifactSurvives(data.season, id))
    scope.postMessage({ type: 'generated', id: msg.id, set })
  } catch {
    // A file whose parts do not line up passes the shape check and fails here.
    scope.postMessage({ type: 'error', id: msg.id })
  }
})
