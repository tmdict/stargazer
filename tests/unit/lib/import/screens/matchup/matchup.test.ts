import { describe, expect, it } from 'vitest'

import { FRAME_NAMES, prepareFrameRefs } from '@/lib/import/card/frames'
import { buildHeroTable } from '@/lib/import/card/heroes'
import type { RgbaImage } from '@/lib/import/core/types'
import { buildArtifactTable } from '@/lib/import/screens/match/artifacts'
import { readMatchup } from '@/lib/import/screens/matchup/matchup'
import { createImage } from '../../../../fixtures/image'

const GROUND = [229, 225, 214] as const
const WHITE = [254, 250, 245] as const
const CARD = [90, 60, 40] as const

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

// Two panels of a list 1000 px wide, team boxes 440 px wide under their bars:
// cards from 64 to 189 px below the bar, the box's white foot under them to 210.
// The list ends at `clip`, the page's ground below it.
const list = (clip: number): RgbaImage => {
  const img = createImage(1000, 1400)
  fill(img, 0, 0, 1000, 1400, GROUND)
  for (const y of [300, 680]) {
    for (const [x, colour] of [
      [40, [45, 115, 230]],
      [520, [225, 55, 50]],
    ] as const) {
      fill(img, x, y, 440, 10, colour)
      fill(img, x, y + 10, 440, 200, WHITE)
      for (let k = 0; k < 5; k++) fill(img, x + 8 + 84 * k, y + 64, 80, 125, CARD)
    }
  }
  fill(img, 0, clip, 1000, 1400 - clip, GROUND)
  return img
}

const refs = {
  frames: prepareFrameRefs(FRAME_NAMES.map(() => createImage(280, 404))),
  heroes: buildHeroTable([{ characterId: 1, image: createImage(180, 248) }]),
  artifacts: buildArtifactTable([{ artifactId: 1, image: createImage(128, 128) }]),
}

describe('readMatchup', () => {
  it('reads no cards in a box whose foot is out of view, and still its artifact', () => {
    const { panels } = readMatchup(list(860), refs)
    expect(panels.map((p) => [p.blue.cards?.length ?? null, p.red.cards?.length ?? null])).toEqual([
      [5, 5],
      [null, null],
    ])
    expect(panels[1]!.blue.artifact).toBeDefined()
  })
})
