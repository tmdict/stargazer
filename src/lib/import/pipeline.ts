/* One screenshot, already normalised to CANONICAL_WIDTH, to a reading: the
 * Ally and Enemy tabs place the two card columns, each card's frame pins its
 * box, and the face, star row, strip and artifact icons are read from there.
 * The top panel is the viewer's team, taken to be the left player's, as in
 * the game's own history view. */

import { Team } from '@/lib/types/team'
import { readArtifact } from './artifacts'
import {
  ANCHOR_FLOOR,
  findPanelAnchor,
  LANDMARK_FLOOR,
  matchCard,
  paragonFromMatch,
  scanForColumns,
  TAB_ANCHOR_OX,
  type PanelAnchor,
} from './frames'
import { assignUnique, heroDescriptor, rankHeroes } from './heroes'
import { cropResize } from './image'
import {
  ART_BOX,
  CARD_COLUMN_X,
  CARD_PITCH,
  CARD_ROWS,
  CARD_TOP,
  HEADER_ICON,
  PANEL_GAP,
  STRIP,
  TABS,
} from './layout'
import { readStars } from './stars'
import { findTabs, readStrip, readTab, type TabPair } from './strip'
import type {
  ArtifactReading,
  FrameRef,
  HeroCandidate,
  HeroIdentity,
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

interface Columns {
  tabs: TabPair | null
  anchors: Record<Team, PanelAnchor>
  // The comb mean a column must reach to be read.
  floor: number
}

/* The two card columns. The tabs are the landmarks: each team's cards start
 * just under its tab, and the frame comb only settles the exact position
 * there. Without tabs (a crop that lost them) the columns are tried at their
 * crop positions, then found as a pair anywhere in the shot. A column placed
 * by a landmark is trusted down to the lower floor. */
const placeColumns = (shot: RgbaImage, frames: readonly FrameRef[]): Columns => {
  const tabs = findTabs(shot)
  if (tabs) {
    const ally = findPanelAnchor(
      shot,
      frames,
      { x: CARD_COLUMN_X, y: tabs.ally.bottom + TABS.toCard, pitch: CARD_PITCH },
      TAB_ANCHOR_OX,
    )
    const enemy = findPanelAnchor(shot, frames, {
      x: ally.x,
      y: tabs.enemy.bottom + TABS.toCard,
      pitch: ally.pitch,
    })
    return { tabs, anchors: { [Team.ALLY]: ally, [Team.ENEMY]: enemy }, floor: LANDMARK_FLOOR }
  }
  const ally = findPanelAnchor(shot, frames, { x: CARD_COLUMN_X, y: CARD_TOP, pitch: CARD_PITCH })
  const enemy = findPanelAnchor(shot, frames, {
    x: ally.x,
    y: ally.y + PANEL_GAP,
    pitch: CARD_PITCH,
  })
  const pair =
    ally.mean < ANCHOR_FLOOR || enemy.mean < ANCHOR_FLOOR
      ? scanForColumns(shot, frames, CARD_COLUMN_X)
      : null
  if (!pair)
    return { tabs, anchors: { [Team.ALLY]: ally, [Team.ENEMY]: enemy }, floor: ANCHOR_FLOOR }
  return {
    tabs,
    anchors: {
      [Team.ALLY]: findPanelAnchor(shot, frames, pair.ally),
      [Team.ENEMY]: findPanelAnchor(shot, frames, pair.enemy),
    },
    floor: LANDMARK_FLOOR,
  }
}

/* One panel's five cards: each card's frame pins its box, and the face, the
 * star row and a crop for the review come from there. Without a trusted
 * anchor the boxes are guesses, so the cells are offered empty for the
 * picker rather than with a stranger's face. */
const readSide = (
  shot: RgbaImage,
  refs: ReferenceSet,
  anchor: PanelAnchor,
  trusted: boolean,
): HeroReading[] => {
  const cells: Omit<HeroReading, keyof HeroIdentity>[] = []
  const rankings: HeroCandidate[][] = []
  for (let row = 0; row < CARD_ROWS; row++) {
    const match = matchCard(shot, refs.frames, anchor, row)
    const art = artBoxOf(match.box)
    const alignments = ALIGNMENTS.map(([dx, dy]) =>
      heroDescriptor(shot, { ...art, x: art.x + dx, y: art.y + dy }),
    )
    rankings.push(trusted ? rankHeroes(refs.heroes, alignments) : [])
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
      refinement: readStars(shot, match.box),
    })
  }
  const identities = assignUnique(rankings)
  return cells.map((cell, row) => ({ ...cell, ...identities[row]! }))
}

export function readScreenshot(shot: RgbaImage, refs: ReferenceSet): ScreenshotReading {
  const warnings: ImportWarning[] = []
  const { tabs, anchors, floor } = placeColumns(shot, refs.frames)

  const sides = {} as Record<Team, HeroReading[]>
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const trusted = anchors[team].mean >= floor
    if (!trusted) warnings.push({ kind: 'no-panel', side: team })
    sides[team] = readSide(shot, refs, anchors[team], trusted)
    if (!trusted) continue
    sides[team].forEach((cell, row) => {
      if (!cell.recognised) warnings.push({ kind: 'unrecognised', side: team, row })
    })
  }

  // A one-map result has no strip, so its absence is only a warning.
  const enemy = anchors[Team.ENEMY]
  const strip = readStrip(shot, enemy.y + Math.round(enemy.pitch * CARD_ROWS) + STRIP.belowPanel)
  if (!strip) warnings.push({ kind: 'no-strip' })

  const ally = anchors[Team.ALLY]
  const artifacts = {} as Record<Team, ArtifactReading | null>
  for (const team of [Team.ALLY, Team.ENEMY]) {
    artifacts[team] =
      refs.artifacts.ids.length === 0
        ? null
        : readArtifact(shot, ally.x + HEADER_ICON.dx[team], ally.y + HEADER_ICON.dy, refs.artifacts)
  }

  return {
    mapIndex: strip?.mapIndex ?? null,
    mapCount: strip?.mapCount ?? null,
    // The Ally tab is painted in the map winner's colour.
    winner: tabs ? tabs.ally.colour : readTab(shot, ally.x, ally.y),
    mapResults: strip?.mapResults ?? [],
    sides,
    artifacts,
    warnings,
  }
}
