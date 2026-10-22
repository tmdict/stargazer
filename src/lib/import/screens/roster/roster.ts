/* A screenshot of the Resonating Hall, the game's hero roster: where the Hands
 * of Resonance and the grid's cards are, found with no landmark and no fixed
 * position, and each card read with the card reader.
 *
 * The screen draws its cards on a flat cream ground, the colour the hero table
 * flattens portraits onto, and the gutters between the cards stay cream. The
 * grid's six columns are a comb fitted to the share of cream in each pixel column,
 * slab by slab down the shot, so other windows, the game's art and the Hands of
 * Resonance (five cards at a pitch of their own) do not pull it. Rows are the runs
 * of pixel rows where the cards' side edges show, cut at the row pitch where crowns
 * bridge two rows, and trimmed where the bottom bar covers the margin left of the
 * first column. The Hands of Resonance are a comb of five fitted above the first
 * row. Each card is then read with the card reader on a copy scaled so its frame
 * meets the templates, at the scale where the first cards' frames match best, and
 * the shot's cards, the Hands and the grid together, are settled against each
 * other: the screen shows each hero once. A card is sure of its hero only when it
 * leads every other hero it was ranked against, since among some thirty cards the
 * elimination the match screens settle by would pass weak readings as sure. */

import { readCard, settleCards, type CardRead } from '../../card/card'
import type { CardReferences, HeroReading, ParagonReading } from '../../card/types'
import { maskedNcc, resample } from '../../core/image'
import type { Rect, RgbaImage } from '../../core/types'
import { fitComb, median, type Comb } from './comb'
import type { FrameFamily, Grid, RosterReading, RosterSlot, Slot } from './types'

// The cream ground: about (235, 230, 220) on every set, saturation 0.05 to 0.08,
// value 0.91 to 0.93. Grey (the empty slot's placeholder) counts as ground too;
// pure white (the filter button) does not.
const CREAM = { vMin: 0.8, vMax: 0.985, greyS: 0.04, s: 0.13, h: [20, 65] } as const
// The grid is found on a copy at most this wide.
const WORK_MAX = 1000
// The frame's height over its width (the templates are 280 x 404).
const CARD_ASPECT = 404 / 280
// Cards are read on a copy where they are the frame templates' middle width.
const READ_WIDTH = 280 * 0.265
const COLUMNS = 6
// The Hands of Resonance row holds five cards.
const HANDS = 5
const HANDS_GAP = 0.1
// A row of cards is this share of the expected card height; less, and it is cut.
const WHOLE_ROW = [0.85, 1.18] as const
// A card's side edges, as shares of its width from each side: the frame's border,
// or a borderless card's plate, is never ground there.
const EDGE = [0.03, 0.11] as const
// Closed gutters over this share of a card's height are an overlay (the bottom bar
// closes them for about 0.8 of a card), not the frames' side bulges (up to 0.15
// where the gutter is narrowest).
const COVER_RUN = 0.35
// A row on the grid's columns has its inner gutters open over at least this share
// (0.67 to 1 on rows of cards, the narrowest gutters lowest), and the margin left of
// its first column open over at least MARGIN_OPEN: the bottom bar, whose light pills
// leave some inner gutters open (0.59), spans the margin too.
const GUTTER_OPEN = 0.5
const MARGIN_OPEN = 0.6
// A pixel row is closed when at most this many of the five inner gutters are ground.
// The bottom bar's light pills can leave more open; the row's share of open gutters
// (GUTTER_OPEN) tells it from cards.
const CLOSED_OPEN = 1
// The column pitch searched, as a share of the shot's width: a capture of a
// whole desktop puts six columns in a twentieth of it, a crop of the grid in all.
const PITCH_SHARE = [1 / 30, 1 / 5.4] as const
// The shot is cut into about this many slabs, overlapping by half, to find the grid.
const SLABS = 16
// The scroll's top edge sits just under the grid's header, so a first row that runs
// up under it has lost its frames' tops, where the paragon level shows, though its
// sides look whole. On labelled screenshots the header's title is a band of 0.07 to
// 0.12 of a card, and a whole first row's frame box clears it by 0.085 to 0.15 of a
// card, a cut one by 0.046 or less.
const HEADER = { length: [0.05, 0.2], clearance: 0.065 } as const
// The faction filter button floats over the last rows' right columns as a white
// pill. Near-white fills at most 0.08 of a card's box on labelled screenshots, and
// 0.16 of the one the button covers, too much hidden to read.
const COVERED = 0.12
const isWhite = (r: number, g: number, b: number): boolean =>
  Math.min(r, g, b) >= 243 && Math.max(r, g, b) - Math.min(r, g, b) <= 10

const isCream = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max / 255
  if (v < CREAM.vMin || v > CREAM.vMax) return false
  const s = max === 0 ? 0 : (max - min) / max
  if (s <= CREAM.greyS) return true
  if (s > CREAM.s) return false
  let h = 0
  const d = max - min
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return h >= CREAM.h[0] && h <= CREAM.h[1]
}

/* 1 where the shot shows ground. A 3 x 3 majority vote drops the specks of the
 * cream's own texture. */
function groundMask(img: RgbaImage): Uint8Array {
  const { width: w, height: h } = img
  const raw = new Uint8Array(w * h)
  for (let p = 0; p < raw.length; p++) {
    const i = p * 4
    raw[p] = isCream(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!) ? 1 : 0
  }
  const voted = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          n += raw[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))]!
        }
      }
      voted[y * w + x] = n >= 5 ? 1 : 0
    }
  }
  return voted
}

const workCopy = (img: RgbaImage): { work: RgbaImage; f: number } => {
  const f = Math.min(1, WORK_MAX / img.width)
  return {
    f,
    work:
      f === 1
        ? img
        : resample(
            img,
            { x: 0, y: 0, w: img.width, h: img.height },
            Math.round(img.width * f),
            Math.round(img.height * f),
          ),
  }
}

interface Mask {
  ground: Uint8Array
  w: number
  h: number
}

/* The share of ground in each pixel column over rows y0 to y1. */
function columnProfile(m: Mask, y0: number, y1: number, x0 = 0, x1 = m.w): Float32Array {
  const out = new Float32Array(m.w)
  const a = Math.max(0, Math.floor(y0))
  const b = Math.min(m.h, Math.ceil(y1))
  for (let x = Math.max(0, x0); x < Math.min(m.w, x1); x++) {
    let n = 0
    for (let y = a; y < b; y++) n += m.ground[y * m.w + x]!
    out[x] = b > a ? n / (b - a) : 0
  }
  return out
}

interface Band {
  top: number
  bottom: number
  // An occluding bar (or the shot's edge) right above or below.
  cutAbove: boolean
  cutBelow: boolean
  // Per column, the share of the band's rows where a card's side edge shows.
  cols: number[]
  // The share of the band's rows where the grid's inner gutters are ground: high for
  // a row on the grid's columns, low for the Hands of Resonance across them.
  open: number
  // A run of pixel rows whose gutters are covered.
  closed: boolean
}

/* Rows of cards under a comb: the pixel rows where some column shows a card's side
 * edge, in runs. A pixel row where the gutters are not ground is under an overlay
 * spanning the grid (the bottom bar), and splits the runs. */
function bandsOf(
  m: Mask,
  comb: Comb,
  n: number,
): { bands: Band[]; openAt: Float32Array; marginAt: Float32Array; filled: boolean[][] } {
  const { phase, pitch, card } = comb
  const left = (k: number): number => phase + (k + 0.5) * pitch - card / 2
  const strips = Array.from({ length: n }, (_, k) => [
    [left(k) + EDGE[0] * card, left(k) + EDGE[1] * card],
    [left(k) + card - EDGE[1] * card, left(k) + card - EDGE[0] * card],
  ])
  const shows = (y: number, [a, b]: number[]): boolean => {
    let not = 0
    let all = 0
    for (let x = Math.max(0, Math.round(a!)); x <= Math.min(m.w - 1, Math.round(b!)); x++) {
      all++
      if (!m.ground[y * m.w + x]) not++
    }
    return all > 0 && not / all > 0.5
  }
  const gutterGround = (y: number, k: number): boolean => {
    const g = Math.round(phase + k * pitch)
    for (let x = g - 2; x <= g + 2; x++) {
      if (x >= 0 && x < m.w && m.ground[y * m.w + x]) return true
    }
    return false
  }
  const closed: boolean[] = []
  const filled: boolean[][] = []
  const openAt = new Float32Array(m.h)
  // The margin left of the first column: ground on rows of cards, and counted as
  // ground where a crop leaves no margin.
  const marginAt = new Float32Array(m.h)
  for (let y = 0; y < m.h; y++) {
    let open = 0
    for (let k = 1; k < n; k++) if (gutterGround(y, k)) open++
    openAt[y] = open / (n - 1)
    marginAt[y] = phase >= 2 ? (gutterGround(y, 0) ? 1 : 0) : 1
    closed.push(open <= CLOSED_OPEN)
    filled.push(strips.map((pair) => shows(y, pair[0]!) || shows(y, pair[1]!)))
  }
  // The frames' wavy sides close every gutter for a few pixel rows at the same
  // height on each card; only a longer closure is an overlay.
  const covered = closed.map(() => false)
  const minRun = COVER_RUN * card * CARD_ASPECT
  for (let y = 0; y < m.h;) {
    if (!closed[y]) {
      y++
      continue
    }
    let e = y
    while (e < m.h && closed[e]) e++
    if (e - y >= minRun) for (let r = y; r < e; r++) covered[r] = true
    y = e
  }
  const bands: Band[] = []
  // Covered runs are bands of their own, closed: the bottom bar, and the Hands of
  // Resonance, whose cards stand across the grid's gutters.
  for (let r = 0; r < m.h;) {
    if (!covered[r]) {
      r++
      continue
    }
    let e = r
    while (e < m.h && covered[e]) e++
    bands.push({
      top: r,
      bottom: e,
      cutAbove: false,
      cutBelow: false,
      cols: [],
      open: 0,
      closed: true,
    })
    r = e
  }
  let y = 0
  while (y < m.h) {
    if (covered[y] || !filled[y]!.some(Boolean)) {
      y++
      continue
    }
    const top = y
    while (y < m.h && !covered[y] && filled[y]!.some(Boolean)) y++
    const bottom = y
    const cols = Array.from({ length: n }, (_, k) => {
      let c = 0
      for (let r = top; r < bottom; r++) if (filled[r]![k]) c++
      return c / (bottom - top)
    })
    let open = 0
    for (let r = top; r < bottom; r++) for (let k = 1; k < n; k++) if (gutterGround(r, k)) open++
    bands.push({
      top,
      bottom,
      cutAbove: top === 0 || covered[top - 1] === true,
      cutBelow: bottom >= m.h || covered[bottom] === true,
      cols,
      open: open / ((bottom - top) * (n - 1)),
      closed: false,
    })
  }
  return { bands: bands.sort((a, b) => a.top - b.top), openAt, marginAt, filled }
}

/* The grid's columns: the comb fitted on horizontal slabs of the shot, then refitted
 * over the slabs that agree with the best supported fit. The column profile of the
 * whole shot would mix the grid with whatever surrounds it (other windows, the
 * game's art, empty panel); within the grid's own rows its gutters stand out. A
 * fit's support is the summed score of the slabs agreeing with it, and only a fit
 * with a card in each of its six columns somewhere counts: the Hands of Resonance
 * row fits a comb of six with its sixth column empty, and its wider gaps score well. */
function gridComb(m: Mask): Comb | null {
  return slabComb(m, COLUMNS, [m.w * PITCH_SHARE[0], m.w * PITCH_SHARE[1]], 0, m.h)
}

/* A comb of `n` columns fitted slab by slab over rows y0 to y1, as gridComb does. */
function slabComb(
  m: Mask,
  n: number,
  range: readonly [number, number],
  y0: number,
  y1: number,
): Comb | null {
  const slab = Math.max(16, Math.round(m.h / SLABS))
  const fits: { y0: number; y1: number; comb: Comb; profile: Float32Array }[] = []
  for (let a = y0; a + slab <= y1; a += Math.round(slab / 2)) {
    const profile = columnProfile(m, a, a + slab)
    const comb = fitComb(profile, n, range, 0.5, 1)
    if (comb && comb.score > 0) fits.push({ y0: a, y1: a + slab, comb, profile })
  }
  const agreeing = (c: Comb) =>
    fits.filter(
      (f) =>
        Math.abs(f.comb.pitch / c.pitch - 1) < 0.02 &&
        Math.abs(f.comb.phase - c.phase) < 0.1 * c.pitch,
    )
  const full = (c: Comb, group: typeof fits): boolean =>
    Array.from({ length: n }, (_, k) => Math.round(c.phase + (k + 0.5) * c.pitch)).every((x) =>
      group.some((f) => (f.profile[x] ?? 1) < 0.5),
    )
  let best: { comb: Comb; group: typeof fits; support: number; full: boolean } | null = null
  for (const f of fits) {
    const group = agreeing(f.comb)
    const support = group.reduce((sum, g) => sum + g.comb.score, 0)
    const isFull = full(f.comb, group)
    if (!best || (isFull && !best.full) || (isFull === best.full && support > best.support)) {
      best = { comb: f.comb, group, support, full: isFull }
    }
  }
  if (!best || !best.full) return null
  // The agreeing slabs' rows, as one profile.
  const used = new Uint8Array(m.h)
  for (const f of best.group) for (let y = f.y0; y < f.y1; y++) used[y] = 1
  const profile = new Float32Array(m.w)
  let rows = 0
  for (let y = 0; y < m.h; y++) {
    if (!used[y]) continue
    rows++
    for (let x = 0; x < m.w; x++) profile[x]! += m.ground[y * m.w + x]!
  }
  for (let x = 0; x < m.w; x++) profile[x]! /= rows
  const comb = fitComb(profile, n, [best.comb.pitch * 0.97, best.comb.pitch * 1.03])
  return comb && { ...comb, rows: [best.group[0]!.y0, best.group.at(-1)!.y1] }
}

/* The grid and the Hands of Resonance in a shot, in its own pixels. */
function locate(img: RgbaImage): { grid: Grid | null; slots: Slot[] } {
  const { work, f } = workCopy(img)
  const m: Mask = { ground: groundMask(work), w: work.width, h: work.height }
  const comb = gridComb(m)
  if (!comb) return { grid: null, slots: [] }
  const { bands, openAt, marginAt, filled } = bandsOf(m, comb, COLUMNS)
  const expected = comb.card * CARD_ASPECT
  const lengthOf = (b: { top: number; bottom: number }): number => b.bottom - b.top
  const wholeLength = (len: number, h: number): boolean =>
    len >= WHOLE_ROW[0] * h && len <= WHOLE_ROW[1] * h
  const seeds = bands.filter(
    (b) =>
      !b.closed &&
      b.open >= GUTTER_OPEN &&
      !b.cutAbove &&
      !b.cutBelow &&
      wholeLength(lengthOf(b), expected),
  )
  const h = seeds.length ? median(seeds.map(lengthOf)) : expected
  // The row pitch: the closest two whole rows, a row's height and its gap apart.
  const gaps = seeds
    .slice(1)
    .map((b, i) => b.top - seeds[i]!.top)
    .filter((g) => g >= h && g <= 1.4 * h)
  const rowPitch = gaps.length ? Math.min(...gaps) : h * 1.08
  const share = (top: number, bottom: number, at: (y: number) => number): number => {
    let sum = 0
    for (let y = Math.max(0, Math.round(top)); y < Math.min(m.h, Math.round(bottom)); y++)
      sum += at(y)
    return sum / Math.max(1, Math.round(bottom) - Math.round(top))
  }
  // Row candidates: each band, or a band longer than a row (rows whose crowns and
  // shadows bridge the gap between them, or a row running into the bottom bar) cut
  // at the row pitch, in phase with the nearest whole row.
  interface Candidate {
    top: number
    bottom: number
    // Where the whole card's top would be.
    cardTop: number
    band: Band
  }
  const candidates: Candidate[] = []
  // A row's part in view: the longest run of its pixel rows with the margin left of
  // the first column open, across gaps under a tenth of a row. The bottom bar covers
  // that margin where it overlaps a row the scroll fades out under it.
  const inView = (top: number, bottom: number): { top: number; bottom: number } => {
    let best = { top, bottom: top }
    for (let y = Math.round(top); y < bottom;) {
      if (!marginAt[y]) {
        y++
        continue
      }
      const a = y
      let last = y
      while (y < bottom && y - last <= 0.1 * h) {
        if (marginAt[y]) last = y
        y++
      }
      if (last + 1 - a > best.bottom - best.top) best = { top: a, bottom: last + 1 }
      y = last + 1
    }
    return best
  }
  for (const band of bands) {
    if (band.closed) continue
    if (lengthOf(band) <= WHOLE_ROW[1] * h) {
      const seen = inView(band.top, band.bottom)
      if (seen.bottom > seen.top)
        candidates.push({
          ...seen,
          cardTop: seen.top < band.top + 2 ? band.top : seen.bottom - h,
          band,
        })
      continue
    }
    const near = seeds.length
      ? seeds.reduce((a, b) => (Math.abs(b.top - band.top) < Math.abs(a.top - band.top) ? b : a))
      : band
    let t = near.top + Math.round((band.top - near.top) / rowPitch) * rowPitch
    while (t + h > band.top + rowPitch) t -= rowPitch
    for (; t < band.bottom; t += rowPitch) {
      const seen = inView(Math.max(t, band.top), Math.min(t + h, band.bottom))
      if (seen.bottom > seen.top) candidates.push({ ...seen, cardTop: t, band })
    }
  }
  // Slots are template boxes: the card's frame inside, centred.
  const w = comb.card / OPAQUE_SHARE
  const th = w * CARD_ASPECT
  const whiteShare = (b: Rect): number => {
    let n = 0
    let white = 0
    for (let y = Math.max(0, Math.round(b.y)); y < Math.min(m.h, Math.round(b.y + b.h)); y++) {
      for (let x = Math.max(0, Math.round(b.x)); x < Math.min(m.w, Math.round(b.x + b.w)); x++) {
        const i = (y * m.w + x) * 4
        n++
        if (isWhite(work.data[i]!, work.data[i + 1]!, work.data[i + 2]!)) white++
      }
    }
    return n ? white / n : 0
  }
  const slots: Slot[] = []
  let row = 0
  let other = 0
  const at = (k: number): number => comb.phase + (k + 0.5) * comb.pitch - w / 2
  const scaled = (b: Rect): Rect => ({ x: b.x / f, y: b.y / f, w: b.w / f, h: b.h / f })
  const onGrid = (c: Candidate): boolean =>
    share(c.top, c.bottom, (y) => openAt[y]!) >= GUTTER_OPEN &&
    share(c.top, c.bottom, (y) => marginAt[y]!) >= MARGIN_OPEN
  const wholeRows = candidates.filter((c) => onGrid(c) && wholeLength(lengthOf(c), h))
  // The first whole row, when it runs up under the header: the band right above it,
  // past a few pixel rows of crest tips, is the header's, and the row's frame box
  // comes too close to it.
  const headerCut = ((c: Candidate | undefined): Candidate | null => {
    if (!c) return null
    const above = bands
      .filter((b) => b.bottom <= c.top && !(c.top - b.bottom < 0.03 * h && lengthOf(b) < 0.1 * h))
      .at(-1)
    const length = above ? lengthOf(above) / h : 0
    if (!above || above.closed || length < HEADER.length[0] || length > HEADER.length[1])
      return null
    const clearance = ((c.top + c.bottom) / 2 - th / 2 - above.bottom) / h
    return clearance < HEADER.clearance ? c : null
  })(wholeRows[0])
  for (const c of candidates) {
    const len = lengthOf(c)
    const isWhole = wholeRows.includes(c) && c !== headerCut
    // A short row on the grid is cut on the side away from its whole neighbour: the
    // scroll's edge clips the row above the first whole one, the bottom bar the row
    // below the last; failing a neighbour, a split band, the bar or the shot's edge
    // says which.
    let cut: 'above' | 'below' | null = c === headerCut ? 'above' : null
    if (!isWhole && !cut && onGrid(c) && len >= 0.25 * h && len < WHOLE_ROW[0] * h) {
      const below = wholeRows.some((r) => r.top >= c.bottom && r.top - c.bottom < 0.6 * h)
      const above = wholeRows.some((r) => r.bottom <= c.top && c.top - r.bottom < 0.6 * h)
      cut =
        c.top > c.cardTop
          ? 'above'
          : c.bottom < c.cardTop + h - 1 && c.cardTop !== c.band.top
            ? 'below'
            : below
              ? 'above'
              : above
                ? 'below'
                : c.band.cutAbove
                  ? 'above'
                  : c.band.cutBelow
                    ? 'below'
                    : null
    }
    if (!isWhole && !cut) {
      other++
      continue
    }
    const centre = isWhole
      ? (c.top + c.bottom) / 2
      : cut === 'above'
        ? c.bottom - h / 2
        : c.top + h / 2
    const top = centre - th / 2
    const present = Array.from(
      { length: COLUMNS },
      (_, col) => share(c.top, c.bottom, (y) => (filled[y]![col] ? 1 : 0)) > 0.6,
    )
    // Each row of the grid fills from its first column, so a cut row whose cards do
    // not is the bottom bar's Level Up All button, not cards.
    if (!isWhole && present.some((on, col) => on && !present[col - 1] && col > 0)) {
      other++
      continue
    }
    for (let col = 0; col < COLUMNS; col++) {
      if (!present[col] && !isWhole) continue
      const box = { x: at(col), y: top, w, h: th }
      slots.push({
        row,
        col,
        hands: false,
        box: scaled(box),
        kind: !present[col] ? 'empty' : isWhole && whiteShare(box) < COVERED ? 'card' : 'clipped',
        inView: isWhole ? 1 : Math.min(1, len / h),
      })
    }
    row++
  }
  // The Hands of Resonance: a row of five above the grid, at a pitch of its own.
  const firstRow = wholeRows[0]?.top ?? m.h
  for (const box of handsOf(m, comb, h, firstRow) ?? []) {
    slots.push({
      row: -1,
      col: slots.filter((s) => s.hands).length,
      hands: true,
      box: scaled(box),
      kind: 'card',
      inView: 1,
    })
  }
  return {
    grid: {
      comb: { ...comb, phase: comb.phase / f, pitch: comb.pitch / f, card: comb.card / f },
      w: w / f,
      h: h / f,
      rows: row,
      other,
    },
    slots,
  }
}

/* The Hands of Resonance above the grid's first row: five cards fitted as a comb of
 * their own, at a pitch up to half again the grid's, then the run of pixel rows
 * where their side edges show, about a card or a little more tall. */
function handsOf(m: Mask, grid: Comb, h: number, yMax: number): Rect[] | null {
  const comb = slabComb(m, HANDS, [grid.pitch * 0.95, grid.pitch * 1.5], 0, yMax)
  if (!comb || !comb.rows) return null
  const card = comb.card
  const edges = (y: number): boolean => {
    let shown = 0
    for (let k = 0; k < HANDS; k++) {
      const left = comb.phase + (k + 0.5) * comb.pitch - card / 2
      for (const [a, b] of [
        [left + EDGE[0] * card, left + EDGE[1] * card],
        [left + card - EDGE[1] * card, left + card - EDGE[0] * card],
      ]) {
        let not = 0
        let all = 0
        for (let x = Math.max(0, Math.round(a!)); x <= Math.min(m.w - 1, Math.round(b!)); x++) {
          all++
          if (!m.ground[y * m.w + x]) not++
        }
        if (all && not / all > 0.5) {
          shown++
          break
        }
      }
    }
    return shown >= 3
  }
  // The longest run of rows showing three or more cards' edges, around the fit's
  // slabs, across gaps shorter than HANDS_GAP of a row: pale art at a borderless
  // card's edge (a white helmet) reads as ground for a few rows.
  const gap = HANDS_GAP * h
  let best = { top: 0, bottom: 0 }
  const end = Math.min(yMax, comb.rows[1] + h)
  for (let y = Math.max(0, comb.rows[0] - h); y < end;) {
    if (!edges(y)) {
      y++
      continue
    }
    const top = y
    let last = y
    while (y < end && y - last <= gap) {
      if (edges(y)) last = y
      y++
    }
    if (last + 1 - top > best.bottom - best.top) best = { top, bottom: last + 1 }
    y = last + 1
  }
  const len = best.bottom - best.top
  if (len < 0.95 * h || len > 1.6 * h) return null
  const w = card / OPAQUE_SHARE
  return Array.from({ length: HANDS }, (_, k) => ({
    x: comb.phase + (k + 0.5) * comb.pitch - w / 2,
    y: (best.top + best.bottom) / 2 - (w * CARD_ASPECT) / 2,
    w,
    h: w * CARD_ASPECT,
  }))
}

// The frame templates' opaque part is 261 of their 280 px (all but the winged P4),
// so a template box is wider than the card it matches.
const OPAQUE_SHARE = 261 / 280
// The card width the grid gives is off by its gutter estimate; the frames settle the
// template's width among these factors of it.
const SCALES = [0.91, 0.94, 0.97, 1, 1.03, 1.06, 1.09] as const

/* The cards of one size, each read on a copy where they meet the frame
 * templates, the box's top-left the seed. The copy's scale is the one at which
 * the frames of the first cards match best. */
function readSlots(img: RgbaImage, slots: Slot[], refs: CardReferences): CardRead[] {
  if (slots.length === 0) return []
  const margin = 0.3 * slots[0]!.box.w
  const x0 = Math.max(0, Math.min(...slots.map((s) => s.box.x)) - margin)
  const y0 = Math.max(0, Math.min(...slots.map((s) => s.box.y)) - margin)
  const x1 = Math.min(img.width, Math.max(...slots.map((s) => s.box.x + s.box.w)) + margin)
  const y1 = Math.min(img.height, Math.max(...slots.map((s) => s.box.y + s.box.h)) + margin)
  const region = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  if (region.w < 4 || region.h < 4) return []
  const at = (k: number) => {
    const scaled = resample(img, region, Math.round(region.w * k), Math.round(region.h * k))
    // The template box at this scale, about the slot's centre.
    const seeds = slots.map((s) => ({
      x: Math.round((s.box.x + s.box.w / 2 - x0) * k - READ_WIDTH / 2),
      y: Math.round((s.box.y + s.box.h / 2 - y0) * k - (READ_WIDTH * CARD_ASPECT) / 2),
    }))
    return { scaled, seeds }
  }
  const middle = refs.frames.filter((r) => Math.abs(r.scale - 0.265) < 1e-6)
  const probe = slots.slice(0, 8)
  let best = { k: READ_WIDTH / slots[0]!.box.w, score: -Infinity }
  for (const factor of SCALES) {
    const k = READ_WIDTH / (slots[0]!.box.w * factor)
    const { scaled, seeds } = at(k)
    let sum = 0
    for (const seed of seeds.slice(0, probe.length)) {
      let b = -1
      for (let dy = -8; dy <= 8; dy += 2) {
        for (let dx = -6; dx <= 6; dx += 2) {
          for (const r of middle)
            b = Math.max(b, maskedNcc(scaled, r.image, seed.x + dx, seed.y + dy, 3))
        }
      }
      sum += b
    }
    if (sum / probe.length > best.score) best = { k, score: sum / probe.length }
  }
  const { scaled, seeds } = at(best.k)
  return seeds.map((seed) => readCard(scaled, refs, seed, true))
}

// The frame family from the paragon frame match. On labelled roster cards a paragon
// frame matches its template at 0.55 to 0.88 and a card below S+ at 0.22 to 0.56,
// except the winged P4, which scores as low as 0.46 but leads the other levels by
// 0.09 or more, where a card below S+ read as P4 leads by 0.06 or less (bar one at a
// score of 0.36). Between the bounds the family is unsure.
const PARAGON = { score: 0.565, sure: 0.62 } as const
const WINGED = { score: 0.42, lead: 0.08, sureScore: 0.45, sureLead: 0.09 } as const
const BELOW = { sure: 0.5, wingedLead: 0.07 } as const
// A paragon level is sure on a roster card only when it leads the next level by
// this much, whatever its score: P0, P2 and P3 frames match one another's templates
// within 0.014 on misread roster cards, some at scores the match import takes as sure.
const LEVEL_LEAD = 0.02

const frameFamily = ({
  level,
  score,
  runnerUp,
}: ParagonReading): {
  family: FrameFamily
  sure: boolean
} => {
  const lead = score - runnerUp
  const winged = level === 4 && lead >= WINGED.lead && score >= WINGED.score
  if (score >= PARAGON.score || winged) {
    const sure =
      score >= PARAGON.sure || (level === 4 && lead >= WINGED.sureLead && score >= WINGED.sureScore)
    return { family: 'paragon', sure }
  }
  return {
    family: 'below',
    sure: score <= BELOW.sure && !(level === 4 && lead >= BELOW.wingedLead),
  }
}

/* A card's levels as its family has them: P0, R0 by rule below S+, and in doubt
 * whenever the family is. */
const withFamily = (cell: HeroReading, frame: NonNullable<RosterSlot['frame']>): HeroReading => {
  if (frame.family === 'below') {
    return {
      ...cell,
      paragon: { ...cell.paragon, level: 0, sure: frame.sure },
      refinement: { ...cell.refinement, level: 0, sure: frame.sure },
    }
  }
  const lead = cell.paragon.score - cell.paragon.runnerUp
  return {
    ...cell,
    paragon: { ...cell.paragon, sure: frame.sure && lead >= LEVEL_LEAD },
    refinement: { ...cell.refinement, sure: frame.sure && cell.refinement.sure },
  }
}

/* A roster screenshot read: the grid's whole cards, then the Hands of
 * Resonance, whose cards are another size, settled together. Clipped cards are
 * not read: a card the scroll cuts is whole in another screenshot, or not
 * counted. */
export function readRoster(img: RgbaImage, refs: CardReferences): RosterReading {
  const { grid, slots } = locate(img)
  const read = slots.flatMap((s, i) => (!s.hands && s.kind === 'card' ? [i] : []))
  const hands = slots.flatMap((s, i) => (s.hands ? [i] : []))
  const settled = settleCards(
    [
      ...readSlots(
        img,
        read.map((i) => slots[i]!),
        refs,
      ),
      ...readSlots(
        img,
        hands.map((i) => slots[i]!),
        refs,
      ),
    ],
    'all',
  )
  const cells = new Map([...read, ...hands].map((slot, k) => [slot, settled[k]!]))
  return {
    grid,
    slots: slots.map((slot, i) => {
      const cell = cells.get(i)
      if (!cell) return { ...slot, frame: null, cell: null }
      const frame = frameFamily(cell.paragon)
      return { ...slot, frame, cell: withFamily(cell, frame) }
    }),
  }
}
