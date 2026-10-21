/* A result screenshot framed to the layout the readers work in: the panel
 * scaled to CANONICAL_WIDTH and shifted so its tabs stand where layout.ts
 * has them. The game lays the panel out from the screen's width, so the
 * tab's width sets the scale whatever the device, and its left edge the
 * offset whatever margin a crop kept (a desktop window with its title, a
 * whole phone screen). A tab cut by the shot's left edge has neither, and
 * such a crop is taken as starting at the panel, like a shot without tabs. */

import { resample } from '../../core/image'
import type { RgbaImage } from '../../core/types'
import { CANONICAL_WIDTH, TABS } from './layout'
import { findTabs, type TabBlock, type TabPair } from './strip'

export interface FramedPanel {
  image: RgbaImage
  // The tabs found, in the framed image's pixels.
  tabs: TabPair | null
}

export function framePanel(shot: RgbaImage): FramedPanel {
  const found = findTabs(shot)
  const whole = !found || found.left < 1
  // Shot pixels per framed pixel.
  const scale = whole ? shot.width / CANONICAL_WIDTH : found.width / TABS.width
  const x = whole ? 0 : found.left - TABS.left * scale
  const height = Math.round(shot.height / scale)
  const image = resample(
    shot,
    { x, y: 0, w: CANONICAL_WIDTH * scale, h: shot.height },
    CANONICAL_WIDTH,
    height,
  )
  if (!found) return { image, tabs: null }
  const framed = ({ top, bottom, colour }: TabBlock): TabBlock => ({
    top: Math.round(top / scale),
    bottom: Math.round(bottom / scale),
    colour,
  })
  return { image, tabs: { ally: framed(found.ally), enemy: framed(found.enemy) } }
}
