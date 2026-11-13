/* A helper of the Supreme League worker (sl.worker.ts, slHelpers.ts): reads
 * the data file itself and runs the fit checks and board drawings the worker
 * hands it, one at a time. */

import { loadSlData } from '@/lib/pvp/data/codec'
import { fitPoints, type FitJob, type FitPoints } from '@/lib/pvp/generator/fit'
import { boardDraw, type BoardDraw } from '@/lib/pvp/generator/formation'
import type { SlBoard } from '@/lib/pvp/generator/setType'
import type { SlChoiceTeam } from '@/lib/pvp/generator/types'

export type HelperTask =
  | { type: 'fit'; job: FitJob }
  | { type: 'draw'; choice: SlChoiceTeam; board: SlBoard; nonSeasonal: boolean }

export type HelperResponse =
  { type: 'fitted'; points: FitPoints } | { type: 'drawn'; draw: BoardDraw } | { type: 'error' }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin.
const scope = self as unknown as {
  postMessage(message: HelperResponse): void
  addEventListener(type: 'message', listener: (event: MessageEvent<HelperTask>) => void): void
}

const data = loadSlData()

scope.addEventListener('message', async (event) => {
  const task = event.data
  try {
    const file = await data
    scope.postMessage(
      task.type === 'fit'
        ? { type: 'fitted', points: fitPoints(file, task.job) }
        : { type: 'drawn', draw: boardDraw(file, task.choice, task.board, task.nonSeasonal) },
    )
  } catch {
    scope.postMessage({ type: 'error' })
  }
})
