/* Hero identity: the face inside a frame against descriptors of every
 * portrait. The in-game card is a head crop of the same painting the app
 * bundles, at a zoom that varies slightly per hero, so each portrait
 * contributes a grid of crop windows and the best window wins. Ranking runs
 * once at the centre alignment against the whole table, then the other
 * offsets and a finer window grid only for the leaders, which keeps a
 * screenshot to about a second. Descriptors learned from corrections
 * (special icons) join the table as extra rows. */

import { cropResize, dot, flatten, normalizedVector, PORTRAIT_BACKGROUND } from './image'
import type { HeroCandidate, HeroTable, LearnedIcon, Rect, RgbaImage } from './types'

// Worker-resident portrait size: half of the 180 × 248 art, which loses
// nothing at descriptor resolution and keeps the table at a few megabytes.
export const PORTRAIT_SIZE = { width: 90, height: 124 } as const
export const DESCRIPTOR_SIZE = { width: 32, height: 24 } as const
export const DESCRIPTOR_LENGTH = DESCRIPTOR_SIZE.width * DESCRIPTOR_SIZE.height * 3
const ASPECT = DESCRIPTOR_SIZE.height / DESCRIPTOR_SIZE.width

// Crop windows over the half-size portrait: width, horizontal centre, top.
const WINDOWS = {
  w: [44, 52, 60, 68],
  xc: [42, 48, 54],
  yt: [18, 24, 30, 36, 42],
} as const
const REFINE = { w: [-4, -2, 0, 2, 4], xc: [-3, -1, 0, 1, 3], yt: [-4, -2, 0, 2, 4] } as const

const COARSE_KEEP = 60
const REFINE_KEEP = 15
const CANDIDATES = 5

// Descriptor components are unit-norm vectors of ~1300 entries, so they
// rarely exceed ±0.3; Int8 at this scale keeps the correlation to two decimals.
export const QUANT_SCALE = 400

export const quantize = (v: Float32Array): Int8Array => {
  const out = new Int8Array(v.length)
  for (let i = 0; i < v.length; i++)
    out[i] = Math.max(-127, Math.min(127, Math.round(v[i]! * QUANT_SCALE)))
  return out
}

export const dequantize = (q: Int8Array): Float32Array => {
  const out = new Float32Array(q.length)
  for (let i = 0; i < q.length; i++) out[i] = q[i]! / QUANT_SCALE
  return out
}

const windowRect = (w: number, xc: number, yt: number): Rect | null => {
  const h = Math.round(w * ASPECT)
  const x = Math.max(0, Math.min(PORTRAIT_SIZE.width - w, Math.round(xc - w / 2)))
  if (w > PORTRAIT_SIZE.width || yt < 0 || yt + h > PORTRAIT_SIZE.height) return null
  return { x, y: yt, w, h }
}

const windowVector = (portrait: RgbaImage, rect: Rect): Float32Array =>
  normalizedVector(cropResize(portrait, rect, DESCRIPTOR_SIZE.width, DESCRIPTOR_SIZE.height))

export function buildHeroTable(
  portraits: readonly { characterId: number; image: RgbaImage }[],
  learned: readonly LearnedIcon[] = [],
): HeroTable {
  const rows: { id: number; learned: boolean; v: Int8Array }[] = []
  const stored = new Map<number, RgbaImage>()
  for (const { characterId, image } of portraits) {
    const portrait = cropResize(
      flatten(image, PORTRAIT_BACKGROUND),
      { x: 0, y: 0, w: image.width, h: image.height },
      PORTRAIT_SIZE.width,
      PORTRAIT_SIZE.height,
    )
    stored.set(characterId, portrait)
    for (const w of WINDOWS.w) {
      for (const xc of WINDOWS.xc) {
        for (const yt of WINDOWS.yt) {
          const rect = windowRect(w, xc, yt)
          if (rect)
            rows.push({
              id: characterId,
              learned: false,
              v: quantize(windowVector(portrait, rect)),
            })
        }
      }
    }
  }
  for (const icon of learned) {
    const v = decodeLearned(icon.descriptor)
    if (v) rows.push({ id: icon.characterId, learned: true, v })
  }
  const ids = new Int32Array(rows.length)
  const learnedRows = new Uint8Array(rows.length)
  const vectors = new Int8Array(rows.length * DESCRIPTOR_LENGTH)
  rows.forEach((row, i) => {
    ids[i] = row.id
    learnedRows[i] = row.learned ? 1 : 0
    vectors.set(row.v, i * DESCRIPTOR_LENGTH)
  })
  return { ids, learnedRows, vectors, portraits: stored }
}

export const encodeLearned = (v: Float32Array): string => {
  const q = quantize(v)
  let s = ''
  for (let i = 0; i < q.length; i++) s += String.fromCharCode(q[i]! + 128)
  return btoa(s)
}

export const decodeLearned = (encoded: string): Int8Array | null => {
  try {
    const s = atob(encoded)
    if (s.length !== DESCRIPTOR_LENGTH) return null
    const q = new Int8Array(s.length)
    for (let i = 0; i < s.length; i++) q[i] = s.charCodeAt(i) - 128
    return q
  } catch {
    return null
  }
}

/* The descriptor of a face crop of the shot. */
export const heroDescriptor = (shot: RgbaImage, box: Rect): Float32Array =>
  normalizedVector(cropResize(shot, box, DESCRIPTOR_SIZE.width, DESCRIPTOR_SIZE.height))

const rowDot = (table: HeroTable, row: number, v: Float32Array): number => {
  const base = row * DESCRIPTOR_LENGTH
  let s = 0
  for (let i = 0; i < DESCRIPTOR_LENGTH; i++) s += table.vectors[base + i]! * v[i]!
  return s / QUANT_SCALE
}

interface Lead {
  characterId: number
  score: number
  learned: boolean
  row: number
}

/* Rank the table against a face. `alignments` are descriptors of the same
 * cell at small offsets, centre first: the centre ranks everything, the
 * others re-score the leaders, and the finer window grid re-scores the top
 * few against the stored portrait. */
export function rankHeroes(table: HeroTable, alignments: readonly Float32Array[]): HeroCandidate[] {
  const centre = alignments[0]
  if (!centre) return []
  const best = new Map<number, Lead>()
  for (let row = 0; row < table.ids.length; row++) {
    const score = rowDot(table, row, centre)
    const id = table.ids[row]!
    const learned = table.learnedRows[row] === 1
    // Learned rows rank as their own entries so a learned match is visible as such.
    const key = learned ? -id : id
    const cur = best.get(key)
    if (!cur || cur.score < score) best.set(key, { characterId: id, score, learned, row })
  }
  const leaders = [...best.values()].sort((a, b) => b.score - a.score).slice(0, COARSE_KEEP)

  // Each leader keeps its best score over the offsets: the frame match's
  // residual error differs per card, and a hero that only fits at one offset
  // is still that hero.
  for (const lead of leaders) {
    for (let k = 1; k < alignments.length; k++) {
      const s = rowDot(table, lead.row, alignments[k]!)
      if (s > lead.score) lead.score = s
    }
  }
  leaders.sort((a, b) => b.score - a.score)

  // Finer windows around the winning coarse window. Learned rows have no
  // window to refine.
  for (const lead of leaders.slice(0, REFINE_KEEP)) {
    if (lead.learned) continue
    const portrait = table.portraits.get(lead.characterId)
    if (!portrait) continue
    const coarse = coarseWindowOfRow(lead.row, table)
    if (!coarse) continue
    for (const dw of REFINE.w) {
      for (const dx of REFINE.xc) {
        for (const dy of REFINE.yt) {
          const rect = windowRect(coarse.w + dw, coarse.xc + dx, coarse.yt + dy)
          if (!rect) continue
          const v = windowVector(portrait, rect)
          for (const a of alignments) {
            const s = dot(v, a)
            if (s > lead.score) lead.score = s
          }
        }
      }
    }
  }
  leaders.sort((a, b) => b.score - a.score)
  return leaders
    .slice(0, CANDIDATES)
    .map(({ characterId, score, learned }) => ({ characterId, score, learned }))
}

// Rows are emitted per hero in WINDOWS order (w, xc, yt nested), so a row's
// window is its index within the hero's block; learned rows sit after.
const WINDOWS_PER_HERO = WINDOWS.w.length * WINDOWS.xc.length * WINDOWS.yt.length
function coarseWindowOfRow(
  row: number,
  table: HeroTable,
): { w: number; xc: number; yt: number } | null {
  if (table.learnedRows[row] === 1) return null
  let start = row
  while (start > 0 && table.ids[start - 1] === table.ids[row] && table.learnedRows[start - 1] === 0)
    start--
  const k = (row - start) % WINDOWS_PER_HERO
  const w = WINDOWS.w[Math.floor(k / (WINDOWS.xc.length * WINDOWS.yt.length))]
  const xc = WINDOWS.xc[Math.floor(k / WINDOWS.yt.length) % WINDOWS.xc.length]
  const yt = WINDOWS.yt[k % WINDOWS.yt.length]
  return w === undefined || xc === undefined || yt === undefined ? null : { w, xc, yt }
}

export const HERO_SCORE_FLOOR = 0.35
export const HERO_SURE_MARGIN = 0.1

/* A side fields five different heroes, so the same hero read twice on a
 * side goes to the surer cell and the other takes its next candidate. Returns
 * each cell's candidates reordered so the pick comes first, with its margin
 * over the next hero that is not the pick. A learned match must lead the
 * best bundled candidate of another hero by the sure margin to count as sure. */
export function assignUnique(
  rankings: readonly HeroCandidate[][],
): { candidates: HeroCandidate[]; recognised: boolean; margin: number }[] {
  const order = rankings
    .map((cands, i) => ({
      i,
      lead: cands.length > 1 ? cands[0]!.score - cands[1]!.score : cands.length,
    }))
    .sort((a, b) => b.lead - a.lead)
  const taken = new Set<number>()
  const out: { candidates: HeroCandidate[]; recognised: boolean; margin: number }[] = rankings.map(
    () => ({ candidates: [], recognised: false, margin: 0 }),
  )
  for (const { i } of order) {
    const cands = rankings[i]!
    const pick = cands.find((c) => !taken.has(c.characterId) && c.score >= HERO_SCORE_FLOOR)
    if (!pick) {
      out[i] = {
        candidates: cands.filter((c) => !taken.has(c.characterId)),
        recognised: false,
        margin: 0,
      }
      continue
    }
    taken.add(pick.characterId)
    const rest = cands.filter(
      (c) => c.characterId !== pick.characterId && !taken.has(c.characterId),
    )
    const next = rest.find((c) => !pick.learned || !c.learned)
    out[i] = {
      candidates: [pick, ...rest],
      recognised: true,
      margin: next ? pick.score - next.score : pick.score,
    }
  }
  return out
}
