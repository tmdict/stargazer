/* Geometry of the counter ladder: team rows stacked by rating, a rule where
 * the tier changes, and one cubic curve per counter running from the winner
 * to the loser. A higher-rated winner's curve runs down the right side, a
 * lower-rated winner's curve runs up the left side, so the side alone says
 * which way the upset goes. Each curve carries the winner's share of the
 * games, placed where it covers as little of the drawing as the layout
 * allows. Curve coordinates are viewBox units for the SVG; rows, arrowheads
 * and labels are percentages for the HTML overlays, so the drawing scales
 * with its container. */

import { ladderTeams } from '@/lib/pvp/summary'
import type { PvpCounter, PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

export const LADDER_WIDTH = 640
export const LADDER_ROW = 88
// The node column; curves leave and enter at its edges.
const NODE_LEFT = 180
const NODE_RIGHT = 460
// Half a team card's height, the box labels keep off.
const CARD_HALF = 29
// A curve bows out by a base amount plus a step per row it spans, so longer
// counters run outside shorter ones.
const BOW_BASE = 36
const BOW_STEP = 24
// Curve ends sharing a node edge fan apart by this much.
const FAN = 12
// A label's box is estimated from its text: a unit per character, two for a
// wide (CJK) character, plus padding.
const LABEL_CHAR = 7
const LABEL_PAD = 12
const LABEL_H = 16
// Where along its curve a label may sit, nearest the widest point first.
const LABEL_STOPS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82]
// What a label position pays for leaving the drawing, covering another label
// or covering a team card; each curve sample point it covers costs one.
const COST = { outside: 100, label: 12, card: 40 }
const CURVE_SAMPLES = 25
/** A share from fewer games than this is shown dimmed. */
export const FEW_GAMES = 8

export type LadderSide = 'left' | 'right'

export interface LadderRow {
  team: PvpTeam
  top: number
}

export interface LadderTier {
  tier: number
  top: number
}

export interface LadderEdge {
  counter: PvpCounter
  side: LadderSide
  path: string
  /** The loser's end, where the arrowhead sits. */
  arrow: { left: number; top: number }
  /** The share label and its centre. */
  label: { text: string; left: number; top: number }
  /** Fewer than FEW_GAMES games behind the share. */
  few: boolean
}

export interface LadderLayout {
  width: number
  height: number
  /**
   * Horizontal shift, as a percentage of the width, that centres the
   * drawing's outermost curves and labels rather than its node column: the
   * side with the longer bows would otherwise make it sit off-centre.
   */
  offset: number
  /** The node column's left edge and width, as percentages of the width. */
  column: { left: number; width: number }
  rows: LadderRow[]
  tiers: LadderTier[]
  edges: LadderEdge[]
}

type Point = readonly [number, number]
type Curve = readonly [Point, Point, Point, Point]

interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

interface CurveEnd {
  counter: PvpCounter
  otherRow: number
}

const pct = (value: number, total: number): number => Math.round((value / total) * 10000) / 100

const cubicAt = ([p0, p1, p2, p3]: Curve, t: number): Point => {
  const u = 1 - t
  const at = (i: 0 | 1) =>
    u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]
  return [at(0), at(1)]
}

const overlaps = (a: Box, b: Box, margin: number): boolean =>
  a.x0 - margin < b.x1 && a.x1 + margin > b.x0 && a.y0 - margin < b.y1 && a.y1 + margin > b.y0

const labelWidth = (text: string): number =>
  [...text].reduce((units, ch) => units + (ch.codePointAt(0)! > 0x2e7f ? 2 : 1), 0) * LABEL_CHAR +
  LABEL_PAD

export function layoutLadder(
  summary: PvpSeasonSummary,
  shareText: (counter: PvpCounter) => string,
): LadderLayout {
  const teams = ladderTeams(summary)
  const height = LADDER_ROW * teams.length
  const rowOf = new Map(teams.map((team, row) => [team.id, row]))
  const row = (id: string): number => rowOf.get(id) ?? 0
  const cy = (r: number): number => (r + 0.5) * LADDER_ROW

  const rows = teams.map((team, r) => ({ team, top: pct(cy(r), height) }))
  const tiers = teams.flatMap((team, r) =>
    r === 0 || team.tier !== teams[r - 1]!.tier
      ? [{ tier: team.tier, top: pct(r * LADDER_ROW, height) }]
      : [],
  )

  const sideOf = (c: PvpCounter): LadderSide => (row(c.winner) < row(c.loser) ? 'right' : 'left')

  // Every curve end on each node edge, so ends sharing an edge can fan apart
  // in the order of the row they connect to.
  const ends = new Map<string, CurveEnd[]>()
  const addEnd = (id: string, side: LadderSide, end: CurveEnd) => {
    const key = `${id}:${side}`
    ends.set(key, [...(ends.get(key) ?? []), end])
  }
  for (const counter of summary.counters) {
    const side = sideOf(counter)
    addEnd(counter.winner, side, { counter, otherRow: row(counter.loser) })
    addEnd(counter.loser, side, { counter, otherRow: row(counter.winner) })
  }
  const fanOffset = (id: string, side: LadderSide, counter: PvpCounter): number => {
    const list = [...(ends.get(`${id}:${side}`) ?? [])].sort((a, b) => a.otherRow - b.otherRow)
    const slot = list.findIndex((end) => end.counter === counter)
    return (slot - (list.length - 1) / 2) * FAN
  }

  const curves = summary.counters.map((counter) => {
    const side = sideOf(counter)
    const x = side === 'right' ? NODE_RIGHT : NODE_LEFT
    const span = Math.abs(row(counter.loser) - row(counter.winner))
    const bow = BOW_BASE + BOW_STEP * span
    const cx = side === 'right' ? x + bow : x - bow
    const y0 = cy(row(counter.winner)) + fanOffset(counter.winner, side, counter)
    const y1 = cy(row(counter.loser)) + fanOffset(counter.loser, side, counter)
    const points: Curve = [
      [x, y0],
      [cx, y0],
      [cx, y1],
      [x, y1],
    ]
    return {
      counter,
      side,
      span,
      points,
      path: `M${x},${y0} C${cx},${y0} ${cx},${y1} ${x},${y1}`,
      arrow: { left: pct(x, LADDER_WIDTH), top: pct(y1, height) },
      samples: Array.from({ length: CURVE_SAMPLES }, (_, i) =>
        cubicAt(points, i / (CURVE_SAMPLES - 1)),
      ),
    }
  })

  // Each label tries the stops along its own curve, on the curve and just
  // outside it, and takes the position that covers the fewest other curves,
  // labels and cards; ties go to the stop nearest the widest point. Short
  // curves place first: they have the least room. Equal spans place in the
  // report's team order (most played first), so the labels land where the
  // report put them.
  const cards: Box[] = teams.map((_, r) => ({
    x0: NODE_LEFT,
    x1: NODE_RIGHT,
    y0: cy(r) - CARD_HALF,
    y1: cy(r) + CARD_HALF,
  }))
  const gamesOf = new Map(summary.teams.map((team) => [team.id, team.games]))
  const games = (id: string): number => gamesOf.get(id) ?? 0
  const placed = new Map<PvpCounter, { text: string; x: number; y: number; box: Box }>()
  const order = [...curves].sort(
    (a, b) =>
      a.span - b.span ||
      games(b.counter.winner) - games(a.counter.winner) ||
      games(b.counter.loser) - games(a.counter.loser),
  )
  for (const curve of order) {
    const text = shareText(curve.counter)
    const w = labelWidth(text)
    const out = curve.side === 'right' ? 1 : -1
    const others = curves.filter((other) => other !== curve).flatMap((other) => other.samples)
    const cost = (box: Box): number =>
      (box.x0 < 0 || box.x1 > LADDER_WIDTH ? COST.outside : 0) +
      others.filter(
        ([sx, sy]) => sx > box.x0 - 3 && sx < box.x1 + 3 && sy > box.y0 - 3 && sy < box.y1 + 3,
      ).length +
      [...placed.values()].filter((label) => overlaps(box, label.box, 4)).length * COST.label +
      cards.filter((card) => overlaps(box, card, 2)).length * COST.card
    const candidates = LABEL_STOPS.flatMap((t) => {
      const [x, y] = cubicAt(curve.points, t)
      const dist = Math.abs(t - 0.5)
      return [
        { x, y, dist },
        { x: x + out * (w / 2 + 5), y, dist: dist + 0.05 },
      ]
    }).map(({ x, y, dist }) => {
      const box = { x0: x - w / 2, x1: x + w / 2, y0: y - LABEL_H / 2, y1: y + LABEL_H / 2 }
      return { x, y, dist, box, cost: cost(box) }
    })
    const best = candidates.reduce((a, b) =>
      b.cost < a.cost || (b.cost === a.cost && b.dist < a.dist) ? b : a,
    )
    placed.set(curve.counter, { text, x: best.x, y: best.y, box: best.box })
  }

  const edges: LadderEdge[] = curves.map(({ counter, side, path, arrow }) => {
    const label = placed.get(counter)!
    return {
      counter,
      side,
      path,
      arrow,
      label: { text: label.text, left: pct(label.x, LADDER_WIDTH), top: pct(label.y, height) },
      few: counter.wins + counter.losses < FEW_GAMES,
    }
  })

  // The drawing's extremes: the node column at least, else the outermost
  // curve or label box on each side.
  const widest = curves.map((curve) => cubicAt(curve.points, 0.5)[0])
  const boxes = [...placed.values()].map((label) => label.box)
  const leftmost = Math.min(NODE_LEFT, ...widest, ...boxes.map((box) => box.x0))
  const rightmost = Math.max(NODE_RIGHT, ...widest, ...boxes.map((box) => box.x1))
  const offset = pct(LADDER_WIDTH / 2 - (leftmost + rightmost) / 2, LADDER_WIDTH)

  const column = {
    left: pct(NODE_LEFT, LADDER_WIDTH),
    width: pct(NODE_RIGHT - NODE_LEFT, LADDER_WIDTH),
  }

  return { width: LADDER_WIDTH, height, offset, column, rows, tiers, edges }
}
