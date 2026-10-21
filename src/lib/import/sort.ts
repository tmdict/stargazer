/* Which section of the import a pasted screenshot belongs to. */

import type { RgbaImage } from './core/types'
import { fitBoard } from './screens/formation/board'
import type { ShotKind } from './screens/match/types'
import { isReplayFrame } from './screens/replay/replay'
import type { ArenaRef } from './screens/replay/types'
import { findTabs } from './screens/result/strip'

/* A formation panel when a whole board fits it; a replay frame when the
 * replay step takes one (`arena` given), no result tabs show and the arena
 * matches; otherwise a result screen. */
export const sortScreenshot = (image: RgbaImage, arena: ArenaRef | null): ShotKind => {
  if (fitBoard(image)) return 'formation'
  if (arena && !findTabs(image) && isReplayFrame(image, arena)) return 'replay'
  return 'result'
}
