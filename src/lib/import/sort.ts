/* Which section of the import a pasted screenshot belongs to. */

import { fitBoard } from './board'
import type { RgbaImage } from './core/types'
import { isReplayFrame } from './replay'
import { findTabs } from './strip'
import type { ArenaRef, ShotKind } from './types'

/* A formation panel when a whole board fits it; a replay frame when the
 * replay step takes one (`arena` given), no result tabs show and the arena
 * matches; otherwise a result screen. */
export const sortScreenshot = (image: RgbaImage, arena: ArenaRef | null): ShotKind => {
  if (fitBoard(image)) return 'formation'
  if (arena && !findTabs(image) && isReplayFrame(image, arena)) return 'replay'
  return 'result'
}
