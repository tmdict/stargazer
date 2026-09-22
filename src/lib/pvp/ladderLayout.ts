/* Geometry of the counter ladder: team rows stacked by rating, a rule where
 * the tier changes, and one cubic curve per counter running from the winner
 * to the loser. A higher-rated winner's curve runs down the right side, a
 * lower-rated winner's curve runs up the left side, so the side alone says
 * which way the upset goes. Curve coordinates are viewBox units for the SVG;
 * rows, arrowheads and record labels are percentages for the HTML overlays,
 * so the drawing scales with its container. */

import { ladderTeams } from '@/lib/pvp/summary'
import type { PvpCounter, PvpSeasonSummary, PvpTeam } from '@/lib/types/pvp'

export const LADDER_WIDTH = 640
export const LADDER_ROW = 88
// The node column; curves leave and enter at its edges.
const NODE_LEFT = 180
const NODE_RIGHT = 460
// A curve bows out by a base amount plus a step per row it spans, so longer
// counters run outside shorter ones.
const BOW_BASE = 36
const BOW_STEP = 24
// Curve ends sharing a node edge fan apart by this much.
const FAN = 12
// Record labels closer than this on the same side are pushed apart.
const LABEL_H = 18
const LABEL_W = 44

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
  label: { left: number; top: number }
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
  rows: LadderRow[]
  tiers: LadderTier[]
  edges: LadderEdge[]
}

interface CurveEnd {
  counter: PvpCounter
  otherRow: number
}

const pct = (value: number, total: number): number => Math.round((value / total) * 10000) / 100

export function layoutLadder(summary: PvpSeasonSummary): LadderLayout {
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

  const placed = summary.counters.map((counter) => {
    const side = sideOf(counter)
    const x = side === 'right' ? NODE_RIGHT : NODE_LEFT
    const bow = BOW_BASE + BOW_STEP * Math.abs(row(counter.loser) - row(counter.winner))
    const cx = side === 'right' ? x + bow : x - bow
    const y0 = cy(row(counter.winner)) + fanOffset(counter.winner, side, counter)
    const y1 = cy(row(counter.loser)) + fanOffset(counter.loser, side, counter)
    return {
      counter,
      side,
      path: `M${x},${y0} C${cx},${y0} ${cx},${y1} ${x},${y1}`,
      arrow: { left: pct(x, LADDER_WIDTH), top: pct(y1, height) },
      // The curve's outermost point.
      lx: (x + 3 * cx) / 4,
      ly: (y0 + y1) / 2,
    }
  })
  for (const side of ['left', 'right'] as const) {
    const group = placed.filter((edge) => edge.side === side).sort((a, b) => a.ly - b.ly)
    group.forEach((edge, i) => {
      const prev = group[i - 1]
      if (prev && edge.ly - prev.ly < LABEL_H && Math.abs(edge.lx - prev.lx) < LABEL_W) {
        edge.ly = prev.ly + LABEL_H
      }
    })
  }
  const edges = placed.map(({ lx, ly, ...edge }) => ({
    ...edge,
    label: { left: pct(lx, LADDER_WIDTH), top: pct(ly, height) },
  }))

  // The drawing's extremes: the node column at least, else the outermost
  // label edge on each side.
  const leftmost = Math.min(NODE_LEFT, ...placed.map((edge) => edge.lx - LABEL_W / 2))
  const rightmost = Math.max(NODE_RIGHT, ...placed.map((edge) => edge.lx + LABEL_W / 2))
  const offset = pct(LADDER_WIDTH / 2 - (leftmost + rightmost) / 2, LADDER_WIDTH)

  return { width: LADDER_WIDTH, height, offset, rows, tiers, edges }
}
