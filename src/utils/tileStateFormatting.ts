import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

interface StateFormat {
  name: string
  cssClass: string
  fillColor: string
  strokeColor: string
}

const STATE_FORMATS: Record<State, StateFormat> = {
  [State.DEFAULT]: {
    name: 'Default',
    cssClass: 'state-default',
    fillColor: '#f0f0f0',
    strokeColor: '#ccc',
  },
  [State.AVAILABLE_ALLY]: {
    name: 'Available (Ally)',
    cssClass: 'state-available-ally',
    fillColor: '#fff',
    strokeColor: '#36958e',
  },
  [State.AVAILABLE_ENEMY]: {
    name: 'Available (Enemy)',
    cssClass: 'state-available-enemy',
    fillColor: '#ffe8e8',
    strokeColor: '#c05b4d',
  },
  [State.OCCUPIED_ALLY]: {
    name: 'Occupied (Ally)',
    cssClass: 'state-occupied-ally',
    fillColor: '#fff',
    strokeColor: '#36958e',
  },
  [State.OCCUPIED_ENEMY]: {
    name: 'Occupied (Enemy)',
    cssClass: 'state-occupied-enemy',
    fillColor: '#ffe8e8',
    strokeColor: '#c05b4d',
  },
  [State.BLOCKED]: {
    name: 'Blocked',
    cssClass: 'state-blocked',
    fillColor: '#6d6b67',
    strokeColor: '#000',
  },
  [State.BLOCKED_BREAKABLE]: {
    name: 'Blocked (Breakable)',
    cssClass: 'state-blocked-breakable',
    fillColor: '#e1ddd7',
    strokeColor: '#000',
  },
}

export const getStateFormat = (state: State): StateFormat =>
  STATE_FORMATS[state] || STATE_FORMATS[State.DEFAULT]

export const getStateName = (state: State): string => getStateFormat(state).name

export const getStateClass = (state: State): string => getStateFormat(state).cssClass

export const getTileFillColor = (state: State): string => getStateFormat(state).fillColor

export const getTileStrokeColor = (state: State): string => getStateFormat(state).strokeColor

export const getTeamFromTileState = (state: State): Team | null => {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}

export const getInvertedState = (state: State): State => {
  switch (state) {
    case State.AVAILABLE_ALLY:
      return State.AVAILABLE_ENEMY
    case State.AVAILABLE_ENEMY:
      return State.AVAILABLE_ALLY
    case State.OCCUPIED_ALLY:
      return State.OCCUPIED_ENEMY
    case State.OCCUPIED_ENEMY:
      return State.OCCUPIED_ALLY
    default:
      return state
  }
}
