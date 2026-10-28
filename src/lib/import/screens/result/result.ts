/* One screenshot to a reading: the shot is framed to the canonical layout
 * (panel.ts), the Ally and Enemy tabs place the two card columns, each card's
 * frame pins its box, and the face, star row, strip and artifact icons are
 * read from there. Every position in the reading is in the framed image. The
 * top panel is the viewer's team, taken to be the left player's, as in the
 * game's own history view. */

import { Team } from '@/lib/types/team'
import { readCards } from '../../card/card'
import type { FrameRef, HeroReading } from '../../card/types'
import type { RgbaImage } from '../../core/types'
import { readArtifact } from '../match/artifacts'
import type {
  ArtifactReading,
  ImportWarning,
  ReferenceSet,
  ScreenshotReading,
} from '../match/types'
import {
  ANCHOR_FLOOR,
  findPanelAnchor,
  LANDMARK_FLOOR,
  scanForColumns,
  TAB_ANCHOR_OX,
  type PanelAnchor,
} from './columns'
import {
  CARD_COLUMN_X,
  CARD_PITCH,
  CARD_ROWS,
  CARD_STARS,
  CARD_TOP,
  HEADER_ICON,
  PANEL_GAP,
  STRIP,
  TABS,
} from './layout'
import { framePanel } from './panel'
import { readStrip, readTab, type TabPair } from './strip'

// A result screen never shows a companion or phantimal, so its reading needs
// no unit table.
type ResultReferences = Omit<ReferenceSet, 'board' | 'units'>

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
const placeColumns = (
  shot: RgbaImage,
  frames: readonly FrameRef[],
  tabs: TabPair | null,
): Columns => {
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

// A panel's five cards stacked under its anchor.
const columnSeeds = (anchor: PanelAnchor): { x: number; y: number }[] =>
  Array.from({ length: CARD_ROWS }, (_, row) => ({
    x: anchor.x,
    y: Math.round(anchor.y + anchor.pitch * row),
  }))

export function readScreenshot(capture: RgbaImage, refs: ResultReferences): ScreenshotReading {
  const warnings: ImportWarning[] = []
  const { image: shot, tabs: found } = framePanel(capture)
  const { tabs, anchors, floor } = placeColumns(shot, refs.frames, found)

  const sides = {} as Record<Team, HeroReading[]>
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const trusted = anchors[team].mean >= floor
    if (!trusted) warnings.push({ kind: 'no-panel', side: team })
    sides[team] = readCards(shot, refs, columnSeeds(anchors[team]), trusted, CARD_STARS)
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
        : readArtifact(
            shot,
            ally.x + HEADER_ICON.dx[team],
            ally.y + HEADER_ICON.dy,
            refs.artifacts,
            HEADER_ICON.diameter,
          )
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
