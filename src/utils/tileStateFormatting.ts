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
    fillColor: '#f0f0f0',
  },
  [State.AVAILABLE_ALLY]: {
    name: 'Available (Ally)',
    cssClass: 'state-available-ally',
    fillColor: '#fff',
  },
  [State.AVAILABLE_ENEMY]: {
    name: 'Available (Enemy)',
    cssClass: 'state-available-enemy',
    fillColor: '#ffe8e8',
  },
  [State.OCCUPIED_ALLY]: {
    name: 'Occupied (Ally)',
    cssClass: 'state-occupied-ally',
    fillColor: '#fff',
  },
  [State.OCCUPIED_ENEMY]: {
    name: 'Occupied (Enemy)',
    cssClass: 'state-occupied-enemy',
    fillColor: '#ffe8e8',
  },
  [State.BLOCKED]: {
    name: 'Blocked',
    cssClass: 'state-blocked',
    fillColor: '#b5b9bd',
  },
  [State.BLOCKED_BREAKABLE]: {
    name: 'Blocked (Breakable)',
    cssClass: 'state-blocked-breakable',
    fillColor: '#e1e2e0',
  },
}

export const getStateFormat = (state: State): StateFormat =>
  STATE_FORMATS[state] || STATE_FORMATS[State.DEFAULT]

export const getStateName = (state: State): string => getStateFormat(state).name

export const getStateClass = (state: State): string => getStateFormat(state).cssClass

export const getTileFillColor = (state: State): string => getStateFormat(state).fillColor

export const getTeamFromTileState = (state: State): Team | null => {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}

export const getTileHatchFill = (patternId: string, state: State): string | null =>
  state === State.BLOCKED_BREAKABLE ? `url(#${patternId}-breakable)` : null

export const getWallStrokeColor = (state: State): string | null => {
  if (state === State.BLOCKED) return '#858b91'
  if (state === State.BLOCKED_BREAKABLE) return '#a0a59d'
  return null
}

// Blocked walls draw after breakable ones so the darker stroke wins a shared edge.
export const compareWallDrawOrder = (a: State, b: State): number =>
  Number(a === State.BLOCKED) - Number(b === State.BLOCKED)

// Framed thumbnails leave room for their inner border.
const HATCH_INSET = 4 / 18

export const getTileHatchPoints = (corners: Point[]): string => {
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / corners.length
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / corners.length
  const k = 1 - HATCH_INSET
  return corners.map((p) => `${cx + (p.x - cx) * k},${cy + (p.y - cy) * k}`).join(' ')
}
