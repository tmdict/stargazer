/* Which import, and which of its sections, a screenshot belongs to. */

import { resample } from './core/image'
import type { RgbaImage } from './core/types'
import type { ImportKind } from './kinds'
import { FIT_WIDTH, fitBoard } from './screens/formation/board'
import { isReplayFrame } from './screens/replay/replay'
import type { ArenaRef } from './screens/replay/types'
import { findTabs } from './screens/result/strip'
import { isRosterScreen, WORK_MAX } from './screens/roster/roster'

// The roster's grid is told on a copy this wide, as the roster reader finds it;
// the match screens on one FIT_WIDTH wide.
export const SORT_WIDTH = WORK_MAX

/* A roster screen when the roster's grid shows; a formation panel when a whole
 * board fits it; a result screen when its tabs show; a replay frame when the
 * replay step takes one (`arena` given) and the arena matches; null when none is
 * found. `image` is at most SORT_WIDTH wide. The roster's test goes first: it
 * leaves a match screen at once, for want of the roster's cream ground. */
export const sortScreenshot = (image: RgbaImage, arena: ArenaRef | null): ImportKind | null => {
  if (isRosterScreen(image)) return 'roster'
  const k = Math.min(1, FIT_WIDTH / image.width)
  const fit =
    k === 1
      ? image
      : resample(
          image,
          { x: 0, y: 0, w: image.width, h: image.height },
          Math.round(image.width * k),
          Math.round(image.height * k),
        )
  if (fitBoard(fit)) return 'formation'
  if (findTabs(fit)) return 'result'
  if (arena && isReplayFrame(fit, arena)) return 'replay'
  return null
}
