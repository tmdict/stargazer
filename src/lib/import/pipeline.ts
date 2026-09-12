/* One screenshot, already normalised to CANONICAL_WIDTH, to a reading: the
 * two card columns are anchored, each card's frame pins its box, and the
 * face, star row, strip, tab and artifact icons are read from there. */

import { Team } from '@/lib/types/team'
import { readArtifact } from './artifacts'
import { findPanelAnchor, matchCard, paragonFromMatch } from './frames'
import { assignUnique, heroDescriptor, rankHeroes } from './heroes'
import { cropResize } from './image'
import {
  ANCHOR_FLOOR,
  ART_BOX,
  CARD_COLUMN_X,
  CARD_PITCH,
  CARD_ROWS,
  CARD_TOP,
  HEADER_ICON,
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
  const sides = {} as Record<Team, HeroReading[]>
  const anchors = {} as Record<Team, ReturnType<typeof findPanelAnchor>>

  for (const team of [Team.ALLY, Team.ENEMY]) {
    const anchor = findPanelAnchor(shot, refs.frames, CARD_COLUMN_X, CARD_TOP[team])
    anchors[team] = anchor
    if (anchor.mean < ANCHOR_FLOOR) warnings.push({ kind: 'no-panel', side: team })

    const cells: Omit<HeroReading, 'candidates' | 'margin' | 'recognised' | 'sure'>[] = []
    const rankings = []
    for (let row = 0; row < CARD_ROWS; row++) {
      const match = matchCard(
        shot,
        refs.frames,
        CARD_COLUMN_X,
        Math.round(CARD_TOP[team] + CARD_PITCH * row),
        anchor,
      )
      const art = artBoxOf(match.box)
      const alignments = ALIGNMENTS.map(([dx, dy]) =>
        heroDescriptor(shot, { ...art, x: art.x + dx, y: art.y + dy }),
      )
      rankings.push(rankHeroes(refs.heroes, alignments))
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

  const ally = anchors[Team.ALLY]
  const anchorX = CARD_COLUMN_X + ally.ox
  const anchorY = CARD_TOP[Team.ALLY] + ally.oy
  const enemyBottom =
    CARD_TOP[Team.ENEMY] + anchors[Team.ENEMY].oy + Math.round(CARD_PITCH * CARD_ROWS)
  const strip = readStrip(shot, mapCount, enemyBottom + STRIP.belowPanel)
  if (strip.mapIndex === null) warnings.push({ kind: 'no-strip' })

  const artifacts = {} as Record<Team, ReturnType<typeof readArtifact> | null>
  for (const team of [Team.ALLY, Team.ENEMY]) {
    artifacts[team] =
      refs.artifacts.ids.length === 0
        ? null
        : readArtifact(
            shot,
            anchorX + HEADER_ICON.dx[team],
            anchorY + HEADER_ICON.dy,
            refs.artifacts,
          )
  }

  return {
    mapIndex: strip.mapIndex,
    winner: readTab(shot, anchorX, anchorY),
    mapResults: strip.mapResults,
    sides,
    artifacts,
    warnings,
  }
}
