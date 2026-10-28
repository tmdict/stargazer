/* Refinement from the star row above the face. The row sits a fixed distance
 * above the card box's centre, and a full row's six stars sit at fixed places
 * across the card. A row gains a star every five exclusive-weapon levels, and
 * refinement starts only once it holds six, so a short row is R0. A short row
 * is centred too: an odd count puts its stars in the gaps between the six
 * places, an even count leaves the outer places empty. The row is full when its
 * inner places are brighter than the gaps between them and every place about as
 * bright as the inner ones. Bright blobs are not counted: beside a short row the
 * frame's side pieces and gold arcs and the hero's headwear are as bright as
 * stars, and they can light the outer places on their own. The colour family
 * comes from the bright pixels over the six places. A short row waits for
 * review when a refined family's colour is strong, as a full row's outer stars
 * can hide on a blurred capture, and when it is faintly pink and a pixel or two
 * to the side would make it full: a faded R4 row read off its places.
 *
 * Bright headwear beside an unrefined row (a hat, a crown, coloured hair)
 * can tint the colour toward a refined family, so a refined reading is sure
 * only when its family's evidence is strong: a real refined row is one colour
 * from end to end. A full R4 row is a pale rainbow. It stands out from R0 by a
 * faint pink tint, which resampling can halve and a phone's JPEG can erase,
 * and by its colours: an unrefined row's stars are tinted blue, while no
 * rainbow star is mostly blue and the row leans yellow. Either sign makes a
 * full white row R4, and R0 is sure only when the row has no pink and a star
 * that is mostly blue. */

import { hsvAt } from '../core/image'
import type { Rect, RgbaImage } from '../core/types'
import type { RefinementReading, StarFamily } from './types'

const BAND_ROWS = 7
const BRIGHT = 0.78
// A bright pixel is coloured above this saturation.
const COLOURED = 0.15
const STAR_BRIGHT = 0.72
// A place's brightness is its bright pixels over the three columns around it. A
// full row's inner four places beat the gaps by `lead` on average, and none of
// its places has less than `even` of the inner four's mean. On labelled
// screenshots full rows' inner places beat the gaps by 2.3 or more and their
// dimmest place has 0.82 of the inner mean or more. On result screens rows of
// three or five, whose stars sit in the gaps, trail them by 2.5 or more, and rows
// of two or four leave a place at 0.53 of the inner mean or less; on the roster,
// pale art behind a row of two has lifted its dimmest place to 0.63.
const FULL = { lead: 1, even: 0.7 } as const
// Colour is read within this many pixels of each place.
const STAR_REACH = 4
// Evidence a refined reading needs to be sure, about 85% of the weakest
// correctly read row of each level on labelled screenshots: the purple share
// (R1), colour strength and gold share (R2), red share (R3), and the share of
// stars that carry the pink tint on their own (R4). An R4 row read by its
// rainbow is sure when no star's coloured pixels are more than `rainbowBlue`
// blue. A full R0 row is sure under a pink share of `r0Pink` (unrefined rows
// measure below 0.005, R4 rows above 0.04) and with a star at least
// `whiteBlue` blue.
const SURE = {
  purple: 0.58,
  chroma: 0.29,
  gold: 0.5,
  red: 0.37,
  pinkStars: 0.38,
  r0Pink: 0.01,
  rainbowBlue: 0.5,
  whiteBlue: 0.7,
} as const
const PINK = 0.03
// A full white row is R4's rainbow when at least `warm` of its coloured pixels
// are yellow and no star's are `blue` blue. On labelled screenshots R4 rows
// hold 27% yellow or more and stars at most 43% blue, and every R0 row has a
// star 78% blue or more.
const RAINBOW = { warm: 0.2, blue: 0.6 } as const

/* Where a screen's cards hold their star row, measured from the card's box: the
 * row's top `above` pixels over the box's centre, and a full row's six stars
 * `pitch` apart, centred `left` pixels left of the box's middle. Each screen
 * draws its cards' row in its own place, whatever frame matched. */
export interface StarRow {
  above: number
  pitch: number
  left: number
}

/* The highest pixel row the star reader looks at for a card's box. */
export const starRowTop = (box: Rect, row: StarRow): number =>
  box.y + Math.round(box.h / 2) - row.above

/* The columns of a full row's six stars, left to right, and of the five gaps
 * between them, where a row of five puts its stars. */
interface StarPlaces {
  places: readonly number[]
  gaps: readonly number[]
}

const starPlaces = (box: Rect, row: StarRow): StarPlaces => {
  const centre = box.x + box.w / 2 - row.left
  return {
    places: [0, 1, 2, 3, 4, 5].map((k) => Math.round(centre + (k - 2.5) * row.pitch)),
    gaps: [0, 1, 2, 3, 4].map((k) => Math.round(centre + (k - 2) * row.pitch)),
  }
}

const brightAround = (shot: RgbaImage, band: Rect, x: number): number => {
  let n = 0
  for (let y = band.y; y < band.y + band.h; y++) {
    for (let xx = x - 1; xx <= x + 1; xx++) {
      if (xx < 0 || y < 0 || xx >= shot.width || y >= shot.height) continue
      if (hsvAt(shot, xx, y)[2] > STAR_BRIGHT) n++
    }
  }
  return n
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length

const isFull = (shot: RgbaImage, band: Rect, { places, gaps }: StarPlaces): boolean => {
  const lit = places.map((x) => brightAround(shot, band, x))
  const inner = mean(lit.slice(1, 5))
  return (
    inner - mean(gaps.map((x) => brightAround(shot, band, x))) >= FULL.lead &&
    Math.min(...lit) >= FULL.even * inner
  )
}

// No shift adds the stars a short row lacks, so only a full row read off its
// places passes the full test a pixel or two to the side; on labelled
// screenshots no short row does within `SHIFT`.
const SHIFT = 2
const fullNearby = (shot: RgbaImage, band: Rect, { places, gaps }: StarPlaces): boolean => {
  for (let d = -SHIFT; d <= SHIFT; d++) {
    const at = (x: number): number => x + d
    if (d !== 0 && isFull(shot, band, { places: places.map(at), gaps: gaps.map(at) })) return true
  }
  return false
}

/* Each star's own tint, from the bright pixels around its place: the share of
 * the row's stars that carry the pink tint, and the largest share of blue
 * among any one star's coloured pixels. */
const starTints = (
  shot: RgbaImage,
  band: Rect,
  places: readonly number[],
): { pinkStars: number; bluest: number } => {
  let pink = 0
  let bluest = 0
  for (const p of places) {
    let n = 0
    let coloured = 0
    let m = 0
    let blue = 0
    for (let y = band.y; y < band.y + band.h; y++) {
      for (let x = p - STAR_REACH; x <= p + STAR_REACH; x++) {
        if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
        const [h, s, v] = hsvAt(shot, x, y)
        if (v < BRIGHT) continue
        n++
        if (s <= COLOURED) continue
        coloured++
        if (h >= 300) m++
        else if (h >= 180 && h < 240) blue++
      }
    }
    if (n && m / n >= PINK) pink++
    if (coloured) bluest = Math.max(bluest, blue / coloured)
  }
  return { pinkStars: pink / places.length, bluest }
}

export function readStars(shot: RgbaImage, box: Rect, row: StarRow): RefinementReading {
  const stars = starPlaces(box, row)
  const { places } = stars
  const x0 = places[0]! - STAR_REACH
  const band = {
    x: x0,
    y: starRowTop(box, row),
    w: places[5]! + STAR_REACH + 1 - x0,
    h: BAND_ROWS,
  }
  const full = isFull(shot, band, stars)

  const hist = new Array<number>(12).fill(0)
  let n = 0
  let cx = 0
  let cy = 0
  for (let y = band.y; y < band.y + band.h; y++) {
    for (let x = band.x; x < band.x + band.w; x++) {
      if (x < 0 || y < 0 || x >= shot.width || y >= shot.height) continue
      if (!places.some((p) => Math.abs(p - x) <= STAR_REACH)) continue
      const [h, s, v] = hsvAt(shot, x, y)
      if (v < BRIGHT) continue
      n++
      cx += s * Math.cos((h * Math.PI) / 180)
      cy += s * Math.sin((h * Math.PI) / 180)
      if (s > COLOURED) hist[Math.floor(h / 30)]! += 1
    }
  }
  const share = hist.map((c) => c / (n || 1))
  const chroma = Math.hypot(cx, cy) / (n || 1)
  const gold = share[1]! + share[2]!
  const red = share[0]! + share[11]!
  const purple = share[8]! + share[9]!
  const magenta = share[10]! + share[11]!
  const coloured = hist.reduce((sum, c) => sum + c, 0)
  const warm = coloured ? (hist[1]! + hist[2]!) / coloured : 0
  const { pinkStars, bluest } = starTints(shot, band, places)
  const rainbow = warm >= RAINBOW.warm && bluest < RAINBOW.blue

  let family: StarFamily = 'white'
  let level = magenta >= PINK || rainbow ? 4 : 0
  if (chroma >= 0.25 && gold >= 0.4) {
    family = 'gold'
    level = 2
  } else if (chroma >= 0.25 && red >= 0.3) {
    family = 'red'
    level = 3
  } else if (purple >= 0.2) {
    family = 'purple'
    level = 1
  }
  const refined =
    level === 1
      ? purple >= SURE.purple
      : level === 2
        ? chroma >= SURE.chroma && gold >= SURE.gold
        : level === 3
          ? red >= SURE.red
          : level === 4 && (pinkStars >= SURE.pinkStars || (rainbow && bluest <= SURE.rainbowBlue))
  if (!full) {
    const fadedR4 = magenta >= SURE.r0Pink && fullNearby(shot, band, stars)
    return { level: 0, full, family, sure: !refined && !fadedR4 }
  }
  return {
    level,
    full,
    family,
    sure: level === 0 ? magenta < SURE.r0Pink && bluest >= SURE.whiteBlue : refined,
  }
}
