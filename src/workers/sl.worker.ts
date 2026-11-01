/* Supreme League worker: reads the data file, learns the prediction model
 * once, and answers the generator, its engine's formations and Who Would
 * Win?, so neither the search, the placing nor a prediction holds up the
 * page. */

import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlUnit } from '@/lib/pvp/sl/data/types'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import { suggestedUnits } from '@/lib/pvp/sl/generator/suggested'
import type { SlChoice, SlPick } from '@/lib/pvp/sl/generator/types'
import { learnSeason } from '@/lib/pvp/sl/model/models'
import { wwwPanel, type Pair, type WwwPanel, type WwwTeam } from '@/lib/pvp/sl/www/panel'
import { artifactSurvives } from '@/lib/seasonal'

export type SlRequest =
  | { type: 'generate'; id: number; picks: SlPick[]; boards: number[] }
  | { type: 'place'; id: number; set: SlChoice }
  | { type: 'predict'; id: number; teams: Pair<WwwTeam> }

export type SlResponse =
  | { type: 'ready' }
  | { type: 'failed' }
  | { type: 'generated'; id: number; set: SlChoice | null }
  | { type: 'placed'; id: number; units: (SlUnit[] | null)[] }
  | { type: 'predicted'; id: number; panel: WwwPanel }
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
    const counts = (id: number): boolean => artifactSurvives(data.season, id)
    if (msg.type === 'generate') {
      const set = chooseSlSet(data, learned, msg.picks, counts, msg.boards)
      scope.postMessage({ type: 'generated', id: msg.id, set })
    } else if (msg.type === 'place') {
      scope.postMessage({ type: 'placed', id: msg.id, units: suggestedUnits(data, msg.set) })
    } else {
      const panel = wwwPanel(data, learned, msg.teams, counts)
      scope.postMessage({ type: 'predicted', id: msg.id, panel })
    }
  } catch {
    // A file whose parts do not line up passes the shape check and fails here.
    scope.postMessage({ type: 'error', id: msg.id })
  }
})
