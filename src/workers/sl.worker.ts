/* Supreme League worker: reads the data file once and answers the generator,
 * the boards' formations, the swaps tried on them and Who Would Win?, so
 * neither the search, the placing nor a prediction holds up the page. */

import { loadSlData } from '@/lib/pvp/sl/data/codec'
import { chooseSlSet } from '@/lib/pvp/sl/generator/chooser'
import { slFit } from '@/lib/pvp/sl/generator/fit'
import {
  boardDraws,
  engineFormation,
  type BoardDraw,
  type BoardFormation,
} from '@/lib/pvp/sl/generator/formation'
import type { SlBoard } from '@/lib/pvp/sl/generator/setType'
import { previewSwap, type SwapPreview, type SwapRequest } from '@/lib/pvp/sl/generator/swapPreview'
import type { SlChoice, SlChoiceTeam, SlPick } from '@/lib/pvp/sl/generator/types'
import { readSlFile } from '@/lib/pvp/sl/model/reader'
import { wwwPanel, type Pair, type WwwPanel, type WwwTeam } from '@/lib/pvp/sl/www/panel'
import { artifactSurvives } from '@/lib/seasonal'

export type SlRequest =
  | { type: 'generate'; id: number; picks: SlPick[]; boards: SlBoard[] }
  | { type: 'place'; id: number; set: SlChoice; boards: SlBoard[] }
  | { type: 'placeEngine'; id: number; team: SlChoiceTeam; board: SlBoard }
  | { type: 'swap'; id: number; swap: SwapRequest }
  | { type: 'predict'; id: number; teams: Pair<WwwTeam> }

export type SlResponse =
  | { type: 'ready' }
  | { type: 'failed' }
  | { type: 'generated'; id: number; set: SlChoice | null }
  | { type: 'placed'; id: number; boards: BoardDraw[] }
  | { type: 'placedEngine'; id: number; formation: BoardFormation }
  | { type: 'swapped'; id: number; preview: SwapPreview }
  | { type: 'predicted'; id: number; panel: WwwPanel }
  | { type: 'error'; id: number }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin.
const scope = self as unknown as {
  postMessage(message: SlResponse): void
  addEventListener(type: 'message', listener: (event: MessageEvent<SlRequest>) => void): void
}

const engine = loadSlData().then((data) => ({ data, reader: readSlFile(data), fit: slFit(data) }))

engine.then(
  () => scope.postMessage({ type: 'ready' }),
  () => scope.postMessage({ type: 'failed' }),
)

scope.addEventListener('message', async (event) => {
  const msg = event.data
  try {
    const { data, reader, fit } = await engine
    const counts = (id: number): boolean => artifactSurvives(data.season, id)
    if (msg.type === 'generate') {
      const set = chooseSlSet(data, reader, msg.picks, counts, msg.boards, fit)
      scope.postMessage({ type: 'generated', id: msg.id, set })
    } else if (msg.type === 'place') {
      const boards = boardDraws(data, msg.set, msg.boards)
      scope.postMessage({ type: 'placed', id: msg.id, boards })
    } else if (msg.type === 'placeEngine') {
      const formation = engineFormation(data, msg.team, msg.board)
      scope.postMessage({ type: 'placedEngine', id: msg.id, formation })
    } else if (msg.type === 'swap') {
      const preview = previewSwap(data, reader, fit, counts, msg.swap)
      scope.postMessage({ type: 'swapped', id: msg.id, preview })
    } else {
      const panel = wwwPanel(data, reader, msg.teams, counts)
      scope.postMessage({ type: 'predicted', id: msg.id, panel })
    }
  } catch {
    // A file whose parts do not line up passes the shape check and fails here.
    scope.postMessage({ type: 'error', id: msg.id })
  }
})
