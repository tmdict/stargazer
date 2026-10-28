import { describe, expect, it } from 'vitest'

import type { RgbaImage } from '@/lib/import/core/types'
import { findPanels, isMatchupScreen } from '@/lib/import/screens/matchup/bars'
import { createImage } from '../../../../fixtures/image'

const GROUND = [229, 225, 214] as const
const BLUE = [45, 115, 230] as const
const RED = [225, 55, 50] as const

const fill = (
  img: RgbaImage,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: readonly number[],
) => {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++)
      img.data.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], (py * img.width + px) * 4)
  }
}

// A list 1000 px wide: bars 440 px wide and 10 tall, a blue one from x 40 and a
// red one from x 520, the red drawn a few pixels higher as the game draws it.
const list = (bars: { colour: 'blue' | 'red'; y: number }[]): RgbaImage => {
  const img = createImage(1000, 1400)
  fill(img, 0, 0, 1000, 1400, GROUND)
  for (const { colour, y } of bars)
    fill(img, colour === 'blue' ? 40 : 520, y, 440, 10, colour === 'blue' ? BLUE : RED)
  return img
}

describe('findPanels', () => {
  it('pairs each blue bar with the red bar beside it, top to bottom', () => {
    const panels = findPanels(
      list([
        { colour: 'red', y: 676 },
        { colour: 'blue', y: 680 },
        { colour: 'blue', y: 300 },
        { colour: 'red', y: 296 },
      ]),
    )
    expect(panels).toEqual([
      { blue: { x: 40, y: 300, w: 440, h: 10 }, red: { x: 520, y: 296, w: 440, h: 10 } },
      { blue: { x: 40, y: 680, w: 440, h: 10 }, red: { x: 520, y: 676, w: 440, h: 10 } },
    ])
  })

  it('pairs no bar with one a panel away', () => {
    const shot = list([
      { colour: 'blue', y: 300 },
      { colour: 'red', y: 680 },
    ])
    expect(findPanels(shot)).toEqual([])
    expect(isMatchupScreen(shot)).toBe(false)
  })
})
