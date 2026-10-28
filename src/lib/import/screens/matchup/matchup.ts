/* A screenshot of the Supreme League's knockout matchup list: its games'
 * panels, found by their team bars (bars.ts), and in each team box the five hero
 * cards, read with the card reader at the scale where their frames match best,
 * and the artifact, read with the match screens' artifact reader. A player
 * fields each hero once in a match, so one side's cards across the shot are
 * settled together, each lead measured over every hero the card was ranked
 * against, as the roster's are. A box whose foot is out of view, under the
 * bottom bar or past the shot's edge, reads no cards: a hidden card row still
 * matches the frames, and its faces can read as heroes on blank ground. */

import { readCardBoxes, settleCards, type CardRead } from '../../card/card'
import { CARD_ASPECT, frameFamily, withFamily } from '../../card/frames'
import type { HeroReading } from '../../card/types'
import { hsvAt } from '../../core/image'
import type { Rect, RgbaImage } from '../../core/types'
import { readArtifact } from '../match/artifacts'
import type { ReferenceSet } from '../match/types'
import { findPanels } from './bars'
import { CARD_STARS, CARDS, DISC, FOOT } from './layout'
import type { BarColour, MatchupReading, MatchupTeam } from './types'

type MatchupReferences = Pick<ReferenceSet, 'frames' | 'heroes' | 'artifacts'>

const isWhite = (img: RgbaImage, x: number, y: number): boolean => {
  const [, s, v] = hsvAt(img, x, y)
  return v > 0.94 && s < 0.06
}

const cardsInView = (img: RgbaImage, bar: Rect): boolean => {
  const end = Math.min(img.height, Math.round(bar.y + FOOT.to * bar.w))
  let run = 0
  for (let y = Math.round(bar.y + FOOT.from * bar.w); y < end; y++) {
    let white = 0
    let n = 0
    for (let x = Math.round(bar.x + 0.05 * bar.w); x < bar.x + 0.95 * bar.w; x += 2) {
      n++
      if (isWhite(img, x, y)) white++
    }
    run = white >= FOOT.white * n ? run + 1 : 0
    if (run >= FOOT.least * bar.w) return true
  }
  return false
}

const cardBoxes = (bar: Rect): Rect[] =>
  [0, 1, 2, 3, 4].map((i) => ({
    x: Math.round(bar.x + (CARDS.x + CARDS.pitch * i) * bar.w),
    y: Math.round(bar.y + CARDS.y * bar.w),
    w: Math.round(CARDS.w * bar.w),
    h: Math.round(CARDS.w * bar.w * CARD_ASPECT),
  }))

// A card below S+ reads as P0, R0 (frameFamily).
const withOwnFamily = (cell: HeroReading): HeroReading =>
  withFamily(cell, frameFamily(cell.paragon))

const readTeam = (
  img: RgbaImage,
  bar: Rect,
  colour: BarColour,
  refs: MatchupReferences,
): Omit<MatchupTeam, 'cards'> & { reads: CardRead[] | null } => {
  const discX = colour === 'blue' ? bar.x + DISC.dx * bar.w : bar.x + bar.w - DISC.dx * bar.w
  return {
    bar,
    artifact: readArtifact(
      img,
      discX,
      bar.y + DISC.dy * bar.w,
      refs.artifacts,
      Math.round(DISC.diameter * bar.w),
    ),
    reads: cardsInView(img, bar) ? readCardBoxes(img, cardBoxes(bar), refs, CARD_STARS) : null,
  }
}

export function readMatchup(img: RgbaImage, refs: MatchupReferences): MatchupReading {
  const panels = findPanels(img)
  const side = (colour: BarColour): MatchupTeam[] => {
    const teams = panels.map((panel) => readTeam(img, panel[colour], colour, refs))
    const cells = settleCards(
      teams.flatMap((team) => team.reads ?? []),
      'all',
    )
    let at = 0
    return teams.map(({ reads, ...team }) => {
      const cards = reads && cells.slice(at, at + reads.length).map(withOwnFamily)
      at += reads?.length ?? 0
      return { ...team, cards }
    })
  }
  const blue = side('blue')
  const red = side('red')
  return { panels: panels.map((_, i) => ({ blue: blue[i]!, red: red[i]! })) }
}
