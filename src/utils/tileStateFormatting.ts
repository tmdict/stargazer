import type { Point } from '@/lib/layout'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

interface StateFormat {
  name: string
  cssClass: string
  fillColor: string
}

const STATE_FORMATS: Record<State, StateFormat> = {
  [State.DEFAULT]: {
    name: 'Default',
    cssClass: 'state-default',
    fillColor: 'var(--tile-fill-default)',
  },
  [State.AVAILABLE_ALLY]: {
    name: 'Available (Ally)',
    cssClass: 'state-available-ally',
    fillColor: 'var(--tile-fill-ally)',
  },
  [State.AVAILABLE_ENEMY]: {
    name: 'Available (Enemy)',
    cssClass: 'state-available-enemy',
    fillColor: 'var(--tile-fill-enemy)',
  },
  [State.OCCUPIED_ALLY]: {
    name: 'Occupied (Ally)',
    cssClass: 'state-occupied-ally',
    fillColor: 'var(--tile-fill-ally)',
  },
  [State.OCCUPIED_ENEMY]: {
    name: 'Occupied (Enemy)',
    cssClass: 'state-occupied-enemy',
    fillColor: 'var(--tile-fill-enemy)',
  },
  [State.BLOCKED]: {
    name: 'Blocked',
    cssClass: 'state-blocked',
    fillColor: 'var(--tile-fill-blocked)',
  },
  [State.BLOCKED_BREAKABLE]: {
    name: 'Blocked (Breakable)',
    cssClass: 'state-blocked-breakable',
    fillColor: 'var(--tile-fill-breakable)',
  },
}

const getStateFormat = (state: State): StateFormat =>
  STATE_FORMATS[state] || STATE_FORMATS[State.DEFAULT]

export const getStateName = (state: State): string => getStateFormat(state).name

export const getStateClass = (state: State): string => getStateFormat(state).cssClass

export const getTileFillColor = (state: State): string => getStateFormat(state).fillColor

export const getTeamFromTileState = (state: State): Team | null => {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}

// Team colours for SVG drawing, which takes a colour value rather than a CSS
// token; the same as --color-ally and --color-enemy.
export const TEAM_COLORS: Record<Team, string> = {
  [Team.ALLY]: '#36958e',
  [Team.ENEMY]: '#c82333',
}

export const teamTint = (team: Team, alpha: number): string => {
  const rgb = parseInt(TEAM_COLORS[team].slice(1), 16)
  return `rgba(${rgb >> 16}, ${(rgb >> 8) & 255}, ${rgb & 255}, ${alpha})`
}

// Board colours are tokens (variables.css) with a value for each look, so they
// are set through `style`: an SVG attribute does not read var().
const TILE_STROKE_COLOR = 'var(--tile-stroke)'
const TILE_STROKE_COLOR_STRONG = 'var(--tile-stroke-strong)'

// Open ground's outline is dimmer than a deployment tile's or a wall's in the
// dark look.
export const getTileStrokeColor = (state: State): string =>
  state === State.DEFAULT ? 'var(--tile-stroke-default)' : TILE_STROKE_COLOR

// Tile buttons' heavier outline, where open ground is dim only in the dark look.
export const getStrongTileStrokeColor = (state: State): string =>
  state === State.DEFAULT ? 'var(--tile-stroke-strong-default)' : TILE_STROKE_COLOR_STRONG

// The outline of a tile with a unit on it, which in the dark look is the
// unit's frame.
export const HELD_TILE_STROKE_COLORS: Record<Team, string> = {
  [Team.ALLY]: 'var(--tile-stroke-held-ally)',
  [Team.ENEMY]: 'var(--tile-stroke-held-enemy)',
}

export const UNIT_FRAME_COLORS: Record<Team, string> = {
  [Team.ALLY]: 'var(--unit-frame-ally)',
  [Team.ENEMY]: 'var(--unit-frame-enemy)',
}

export const getTileHatchFill = (patternId: string, state: State): string | null =>
  state === State.BLOCKED_BREAKABLE ? `url(#${patternId}-breakable)` : null

export const getWallHatchFill = (patternId: string, state: State): string | null =>
  state === State.BLOCKED ? `url(#${patternId}-blocked)` : getTileHatchFill(patternId, state)

export const getWallStrokeColor = (state: State): string | null => {
  if (state === State.BLOCKED) return 'var(--tile-wall-blocked)'
  if (state === State.BLOCKED_BREAKABLE) return 'var(--tile-wall-breakable)'
  return null
}

// Blocked walls draw after breakable ones so the darker stroke wins a shared edge.
export const compareWallDrawOrder = (a: State, b: State): number =>
  Number(a === State.BLOCKED) - Number(b === State.BLOCKED)

// A framed tile's stripes stop inside its inner line. Fractions of the hex
// radius.
const HATCH_INSET = 4 / 18
export const BEVEL_INSET = 2.5 / 18

const insetPoints = (corners: Point[], inset: number): string => {
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / corners.length
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / corners.length
  const k = 1 - inset
  return corners.map((p) => `${cx + (p.x - cx) * k},${cy + (p.y - cy) * k}`).join(' ')
}

export const getTileHatchPoints = (corners: Point[]): string => insetPoints(corners, HATCH_INSET)

export const getTileBevelPoints = (corners: Point[]): string => insetPoints(corners, BEVEL_INSET)
