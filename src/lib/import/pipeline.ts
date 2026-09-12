/* One screenshot, already normalised to CANONICAL_WIDTH, to a reading: the
 * ally card column is anchored (at its nominal spot, else anywhere in a raw
 * capture), the enemy column below it, each card's frame pins its box, and
 * the face, star row, strip, tab and artifact icons are read from there. The
 * top panel is the viewer's team, taken to be the left player's, as in the
 * game's own history view. */

import { Team } from '@/lib/types/team'
import { readArtifact } from './artifacts'
import { findPanelAnchor, matchCard, paragonFromMatch, scanForColumns } from './frames'
import { assignUnique, heroDescriptor, rankHeroes } from './heroes'
import { cropResize } from './image'
import {
  ANCHOR_FLOOR,
  ART_BOX,
  CARD_COLUMN_X,
  CARD_ROWS,
  CARD_TOP,
  HEADER_ICON,
  PANEL_GAP,
  SCAN_FLOOR,
  STRIP,
} from './layout'
import { readStars } from './stars'
import { readStrip, readTab } from './strip'
import type {
  HeroReading,
  ImportWarning,
  Rect,
  ReferenceSet,
  RgbaImage,
  ScreenshotReading,
} from './types'

// Small offsets of the face crop, centre first, absorbing the frame match's
// residual error.
const ALIGNMENTS: readonly [number, number][] = [
  [0, 0],
  [-2, -3],
  [0, -3],
  [2, -3],
  [-2, 0],
  [2, 0],
  [-2, 3],
  [0, 3],
  [2, 3],
]

const artBoxOf = (box: Rect): Rect => {
  const w = Math.round(box.w * ART_BOX.w)
  return {
    x: Math.round(box.x + box.w * ART_BOX.x),
    y: Math.round(box.y + box.h * ART_BOX.y),
    w,
    h: Math.round(w * ART_BOX.aspect),
  }
}

export function readScreenshot(
  shot: RgbaImage,
  refs: ReferenceSet,
  mapCount: number,
): ScreenshotReading {
  const warnings: ImportWarning[] = []

  // A crop puts the columns at their nominal spots. Anything else (a raw
  // capture, whose background can even hold a stray comb) is found as the
  // pair of columns anywhere in the shot.
  let ally = findPanelAnchor(shot, refs.frames, CARD_COLUMN_X, CARD_TOP[Team.ALLY])
  let enemy = findPanelAnchor(shot, refs.frames, ally.x, ally.y + PANEL_GAP)
  let scanned = false
  if (ally.mean < ANCHOR_FLOOR || enemy.mean < ANCHOR_FLOOR) {
    const found = scanForColumns(shot, refs.frames, CARD_COLUMN_X)
    if (found) {
      ally = findPanelAnchor(shot, refs.frames, found.ally.x, found.ally.y, found.pitch)
      enemy = findPanelAnchor(shot, refs.frames, found.enemy.x, found.enemy.y, found.pitch)
      scanned = true
    }
  }
  const anchors: Record<Team, typeof ally> = { [Team.ALLY]: ally, [Team.ENEMY]: enemy }

  const sides = {} as Record<Team, HeroReading[]>
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const anchor = anchors[team]
    if (anchor.mean < (scanned ? SCAN_FLOOR : ANCHOR_FLOOR))
      warnings.push({ kind: 'no-panel', side: team })

    // Without a frame match the boxes are guesses over unknown card art
    // (a tier whose frame is not among the references), so the cells are
    // offered empty for the picker rather than with a stranger's face. A
    // scanned pair is trusted down to its own floor.
    const anchored = anchor.mean >= (scanned ? SCAN_FLOOR : ANCHOR_FLOOR)
    const cells: Omit<HeroReading, 'candidates' | 'margin' | 'recognised' | 'sure'>[] = []
    const rankings = []
    for (let row = 0; row < CARD_ROWS; row++) {
      const match = matchCard(shot, refs.frames, anchor, row)
      const art = artBoxOf(match.box)
      const alignments = ALIGNMENTS.map(([dx, dy]) =>
        heroDescriptor(shot, { ...art, x: art.x + dx, y: art.y + dy }),
      )
      rankings.push(anchored ? rankHeroes(refs.heroes, alignments) : [])
      const stars = readStars(shot, match.box)
      const cardRect = {
        x: match.box.x - 3,
        y: match.box.y - 3,
        w: match.box.w + 6,
        h: match.box.h + 6,
      }
      cells.push({
        box: match.box,
        card: cropResize(shot, cardRect, cardRect.w, cardRect.h),
        descriptor: alignments[0]!,
        paragon: paragonFromMatch(match),
        refinement: { level: stars.level, stars: stars.stars, family: stars.family },
      })
    }
    const unique = assignUnique(rankings)
    sides[team] = cells.map((cell, row) => {
      const u = unique[row]!
      if (!u.recognised) warnings.push({ kind: 'unrecognised', side: team, row })
      return { ...cell, ...u }
    })
  }

  // A single map has no strip; the one board is the map. Otherwise the
  // strip says how many maps the match had, which need not be the mode's.
  const enemyBottom = enemy.y + Math.round(enemy.pitch * CARD_ROWS)
  const strip =
    mapCount > 1
      ? readStrip(shot, enemyBottom + STRIP.belowPanel)
      : { mapIndex: 0, mapResults: [null], mapCount: 1 }
  if (strip.mapIndex === null) warnings.push({ kind: 'no-strip' })
  else if (strip.mapCount !== mapCount) warnings.push({ kind: 'map-count', found: strip.mapCount! })

  const artifacts = {} as Record<Team, ReturnType<typeof readArtifact> | null>
  for (const team of [Team.ALLY, Team.ENEMY]) {
    artifacts[team] =
      refs.artifacts.ids.length === 0
        ? null
        : readArtifact(shot, ally.x + HEADER_ICON.dx[team], ally.y + HEADER_ICON.dy, refs.artifacts)
  }

  return {
    mapIndex: strip.mapIndex,
    winner: readTab(shot, ally.x, ally.y),
    mapResults: strip.mapResults,
    sides,
    artifacts,
    warnings,
  }
}
