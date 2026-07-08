/* Team mode registry: the single source of truth for the Teams page's grid modes.
 *
 * A mode is a board count plus per-board starting maps; the page's mode picker,
 * per-mode persistence slots, saved-team validation, and share-link routing all
 * key off this table. Adding a mode = one entry here + one i18n label file.
 *
 * Modes are add-only: removing a key would orphan persisted slots, saved teams,
 * and exports that reference it, so a removal requires a written migration.
 */

import type { MultiGridState } from '@/utils/gridStateSerializer'
import { FIVE_V_FIVE_DEFAULT_MAPS } from '../maps'

export type TeamModeKey = '1v1' | '3v3' | '5v5' | '5v5sl'

export interface TeamModeConfig {
  key: TeamModeKey
  labelKey: string
  boardCount: number
  defaultMaps: string[]
  // Wrap (the 3-2 boards layout) only makes sense for 5-board modes.
  canWrap: boolean
}

const arena1 = (count: number): string[] => Array<string>(count).fill('arena1')

export const TEAM_MODES: Record<TeamModeKey, TeamModeConfig> = {
  '1v1': {
    key: '1v1',
    labelKey: 'app.mode-1v1',
    boardCount: 1,
    defaultMaps: arena1(1),
    canWrap: false,
  },
  '3v3': {
    key: '3v3',
    labelKey: 'app.mode-3v3',
    boardCount: 3,
    defaultMaps: arena1(3),
    canWrap: false,
  },
  '5v5': {
    key: '5v5',
    labelKey: 'app.mode-5v5',
    boardCount: 5,
    defaultMaps: arena1(5),
    canWrap: true,
  },
  '5v5sl': {
    key: '5v5sl',
    labelKey: 'app.mode-5v5-sl',
    boardCount: 5,
    defaultMaps: FIVE_V_FIVE_DEFAULT_MAPS,
    canWrap: true,
  },
}

export const TEAM_MODE_ORDER: TeamModeKey[] = ['1v1', '3v3', '5v5', '5v5sl']

export const DEFAULT_TEAM_MODE: TeamModeKey = '5v5sl'

export const MAX_SAVED_TEAMS = 200
export const MAX_TEAM_NAME_LENGTH = 60

export const isTeamModeKey = (key: unknown): key is TeamModeKey =>
  typeof key === 'string' && key in TEAM_MODES

/* Resolve the team mode for a decoded payload. A present `mode` is honored only
 * when its board count matches the payload (a contradictory or unknown mode is
 * treated as absent), so a crafted link can never smuggle a wrong-shaped board
 * array into a mode's slot. Inference for mode-less payloads: 5 boards belong to
 * the Supreme League page (every mode-less 5-board link predates the mode field),
 * otherwise the smallest mode that fits. */
export function resolveTeamMode(state: MultiGridState): TeamModeKey {
  const count = state.boards.length
  if (isTeamModeKey(state.mode) && TEAM_MODES[state.mode].boardCount === count) {
    return state.mode
  }
  if (count === 5) return '5v5sl'
  return TEAM_MODE_ORDER.find((key) => TEAM_MODES[key].boardCount >= count) ?? DEFAULT_TEAM_MODE
}

/* Normalize a decoded payload to its mode's exact shape: truncate extra boards,
 * pad missing ones as empty boards on the mode's default maps. Teams-page ingress
 * only; /share stays lenient and renders payloads as-is. */
export function normalizeTeamPayload(state: MultiGridState, mode: TeamModeKey): MultiGridState {
  const { boardCount, defaultMaps } = TEAM_MODES[mode]
  const boards = state.boards.slice(0, boardCount)
  while (boards.length < boardCount) {
    boards.push({ m: defaultMaps[boards.length] })
  }
  return { ...state, boards, mode }
}
