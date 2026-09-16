/* Team mode registry: the single source of truth for the Teams page's grid modes
 * and their variants.
 *
 * A mode is a board count plus per-board default maps; the page's mode picker,
 * per-mode persistence slots, saved-team validation, share-link routing and the
 * wire id all key off this table. Board counts are unique across modes, so a
 * mode key, a board count and a wire id name the same thing.
 *
 * A variant is a named per-board map list within one mode (Supreme League,
 * Guild Duel). It is derived from the boards' ordered map keys wherever it is
 * needed and never persisted: nothing about it reaches the JSON payload, the
 * wire, or a storage key, so anything not present in the boards themselves
 * cannot be a variant. A new in-game mode on an existing board count is a
 * TEAM_VARIANTS row plus a label file; only a new board count is a new mode
 * (a TEAM_MODES row, a wire id, a slot).
 */

import type { MultiGridState } from '@/utils/gridStateSerializer'
import { DEFAULT_MAP_KEY } from '../maps'
import { stripRetiredSeasonal } from '../seasonal'

export type TeamModeKey = '1v1' | '3v3' | '5v5'

export type TeamVariantKey = 'sl' | 'gd'

export interface TeamModeConfig {
  key: TeamModeKey
  labelKey: string
  boardCount: number
  // The neutral list: pads short payloads and is the Default choice.
  defaultMaps: string[]
  // The variant a fresh slate opens on; absent means the default maps.
  initialVariant?: TeamVariantKey
  // Wrap (the 3-2 boards layout) only makes sense for 5-board modes.
  canWrap: boolean
  // Whether the Syn toggle is offered: the in-game friend-assist mechanic is
  // 1v1-only, and normalizeTeamPayload strips y from modes without it.
  allowSynergy: boolean
}

export interface TeamVariantConfig {
  key: TeamVariantKey
  mode: TeamModeKey
  labelKey: string
  // One map key per board, in board order: the in-game list for this mode.
  maps: string[]
}

const defaultMapList = (count: number): string[] => Array<string>(count).fill(DEFAULT_MAP_KEY)

export const TEAM_MODES: Record<TeamModeKey, TeamModeConfig> = {
  '1v1': {
    key: '1v1',
    labelKey: 'app.mode-1v1',
    boardCount: 1,
    defaultMaps: defaultMapList(1),
    canWrap: false,
    allowSynergy: true,
  },
  '3v3': {
    key: '3v3',
    labelKey: 'app.mode-3v3',
    boardCount: 3,
    defaultMaps: defaultMapList(3),
    initialVariant: 'gd',
    canWrap: false,
    allowSynergy: false,
  },
  '5v5': {
    key: '5v5',
    labelKey: 'app.mode-5v5',
    boardCount: 5,
    defaultMaps: defaultMapList(5),
    initialVariant: 'sl',
    canWrap: true,
    allowSynergy: false,
  },
}

/* A season rotation edits a row's map list here and nowhere else: slots and
 * records keep their maps, and boards that no longer match simply stop
 * reading as that variant. */
export const TEAM_VARIANTS: Record<TeamVariantKey, TeamVariantConfig> = {
  sl: {
    key: 'sl',
    mode: '5v5',
    labelKey: 'app.mode-sl',
    maps: ['arena1', 'arena2', 'preset-sr2', 'preset-sr3', 'preset-sr1'],
  },
  gd: {
    key: 'gd',
    mode: '3v3',
    labelKey: 'app.mode-gd',
    maps: ['arena1', 'preset-sr3', 'preset-sr8'],
  },
}

export const TEAM_MODE_ORDER: TeamModeKey[] = ['1v1', '3v3', '5v5']

export const DEFAULT_TEAM_MODE: TeamModeKey = '5v5'

export const MAX_SAVED_TEAMS = 500
export const MAX_TEAM_NAME_LENGTH = 60

export const DEFAULT_VARIANT = 'default' as const
// What a picker, a filter, or a rebuild can name.
export type TeamVariantChoice = TeamVariantKey | typeof DEFAULT_VARIANT
// null = custom maps, matching nothing.
export type VariantMatch = TeamVariantChoice | null

export const isTeamModeKey = (key: unknown): key is TeamModeKey =>
  typeof key === 'string' && Object.hasOwn(TEAM_MODES, key)

export const variantsForMode = (mode: TeamModeKey): TeamVariantConfig[] =>
  Object.values(TEAM_VARIANTS).filter((variant) => variant.mode === mode)

export const variantMaps = (mode: TeamModeKey, choice: TeamVariantChoice): string[] =>
  choice === DEFAULT_VARIANT ? TEAM_MODES[mode].defaultMaps : TEAM_VARIANTS[choice].maps

export const initialMaps = (mode: TeamModeKey): string[] =>
  variantMaps(mode, TEAM_MODES[mode].initialVariant ?? DEFAULT_VARIANT)

/* Ordered exact match of the boards' map keys against the mode's lists. A
 * board without a key counts as the mode's default map for its index, which is
 * what a fresh context gives it. */
export function matchVariant(
  mode: TeamModeKey,
  maps: readonly (string | undefined)[],
): VariantMatch {
  const { defaultMaps } = TEAM_MODES[mode]
  if (maps.length !== defaultMaps.length) return null
  const resolved = maps.map((map, i) => map ?? defaultMaps[i])
  const equals = (list: readonly string[]): boolean => list.every((map, i) => map === resolved[i])
  if (equals(defaultMaps)) return DEFAULT_VARIANT
  return variantsForMode(mode).find((variant) => equals(variant.maps))?.key ?? null
}

/* Resolve the team mode for a decoded payload. A present `mode` is honored only
 * when its board count matches the payload (a contradictory or unknown mode is
 * treated as absent), so a crafted payload can never smuggle a wrong-shaped
 * board array into a mode's slot. Mode-less payloads take the smallest mode
 * that fits. */
export function resolveTeamMode(state: MultiGridState): TeamModeKey {
  const count = state.boards.length
  if (isTeamModeKey(state.mode) && TEAM_MODES[state.mode].boardCount === count) {
    return state.mode
  }
  return TEAM_MODE_ORDER.find((key) => TEAM_MODES[key].boardCount >= count) ?? DEFAULT_TEAM_MODE
}

/* Normalize a decoded payload to its mode's exact shape: truncate extra boards,
 * pad missing ones as empty boards on the mode's default maps. Teams-page ingress
 * only; /share stays lenient and renders payloads as-is. */
export function normalizeTeamPayload(state: MultiGridState, mode: TeamModeKey): MultiGridState {
  const { boardCount, defaultMaps, allowSynergy } = TEAM_MODES[mode]
  // Retired seasonal content must not reach live boards: its reused ids would
  // resolve to the new season's content. Saved records keep theirs (this runs
  // on ingress only); display surfaces mask instead of resolving.
  state = stripRetiredSeasonal(state)
  let boards = state.boards.slice(0, boardCount)
  while (boards.length < boardCount) {
    boards.push({ m: defaultMaps[boards.length] })
  }
  // Synergy units are 1v1-only content. On other modes a crafted y section
  // would bypass the page-wide duplicate repair (its ids differ from the base
  // hero's), so it is stripped at ingress rather than rendered leniently.
  if (!allowSynergy) {
    boards = boards.map((board) => {
      if (board.y === undefined) return board
      const stripped = { ...board }
      delete stripped.y
      return stripped
    })
  }
  return { ...state, boards, mode }
}
