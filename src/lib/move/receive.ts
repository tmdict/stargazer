/* Applying a hand-over on the new address, before any page reads saved data.
 * Saved teams and rosters go through their stores' own Import, so a library
 * already started here is merged into, never replaced. Boards in progress and
 * settings only fill gaps. */

import type { Pinia } from 'pinia'

import { MAX_ROSTERS, parseRostersImport } from '@/lib/rosters'
import { MAX_SAVED_TEAMS, TEAM_MODE_ORDER } from '@/lib/teams/modes'
import { teamContentKey, type SavedTeam } from '@/lib/teams/savedTeam'
import { parseImport } from '@/lib/teams/transfer'
import { useRosters } from '@/stores/rosters'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { readFlag, writeFlag } from '@/utils/flags'
import type { GridState } from '@/utils/gridStateSerializer'
import { PREFS_KEY, readPrefs } from '@/utils/prefs'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import { decodeGridStateFromUrl, decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'
import { HAND_OVER_FAILED, ROSTERS_KEY, TEAMS_KEY, type HandOverResult } from './config'
import { unpackCode } from './pack'

const exportFile = (kind: string, listKey: string, stored: string): string | null => {
  try {
    return JSON.stringify({ app: 'stargazer', kind, [listKey]: JSON.parse(stored) })
  } catch {
    return null
  }
}

const hasUnits = (board: GridState): boolean =>
  Boolean(
    board.c?.length || board.s?.length || board.y?.length || board.a?.some((id) => id !== null),
  )

const arenaInUse = (): boolean => {
  const stored = readStorage('stargazer.arena')
  const board = stored === null ? null : decodeGridStateFromUrl(stored)
  return board !== null && hasUnits(board)
}

const teamsSlotInUse = (key: string): boolean => {
  const stored = readStorage(key)
  if (stored === null) return false
  try {
    const { data } = JSON.parse(stored) as { data?: unknown }
    const state = typeof data === 'string' ? decodeMultiGridStateFromUrl(data) : null
    return state !== null && state.boards.some(hasUnits)
  } catch {
    return false
  }
}

/* A Teams board names the saved team it was loaded from, and Save writes to
 * that team. An id this address already held may be other work, so the name
 * is kept only where both addresses hold the same team under it. */
const withSafeSource = (slot: string, held: Map<string, SavedTeam>, carried: string): string => {
  const stored = JSON.parse(slot) as { sourceId?: unknown }
  const here = typeof stored.sourceId === 'string' ? held.get(stored.sourceId) : undefined
  if (!here) return slot
  const records = JSON.parse(carried) as unknown
  const there = Array.isArray(records)
    ? (records as { id?: unknown; data?: unknown }[]).find((r) => r?.id === here.id)
    : undefined
  const same =
    typeof there?.data === 'string' && teamContentKey(there.data) === teamContentKey(here.data)
  return same ? slot : JSON.stringify({ ...stored, sourceId: null })
}

const fillBoards = (items: Map<string, string>, held: Map<string, SavedTeam>): void => {
  const arena = items.get('stargazer.arena')
  if (arena !== undefined && !arenaInUse()) {
    writeStorage('stargazer.arena', arena)
    // A board with no season marker reads as last season's, and one with no
    // pick as a plain map, so both follow the board even when absent.
    for (const key of ['stargazer.season', 'stargazer.arena.variant']) {
      const value = items.get(key)
      if (value === undefined) removeStorage(key)
      else writeStorage(key, value)
    }
  }
  for (const mode of TEAM_MODE_ORDER) {
    const key = `stargazer.teams.active.${mode}`
    const slot = items.get(key)
    if (slot !== undefined && !teamsSlotInUse(key)) {
      writeStorage(key, withSafeSource(slot, held, items.get(TEAMS_KEY) ?? '[]'))
    }
  }
}

const fillSettings = (items: Map<string, string>): void => {
  for (const key of ['stargazer.teams.mode', 'stargazer.locale', 'stargazer.skillLocale']) {
    const value = items.get(key)
    if (value !== undefined && readStorage(key) === null) writeStorage(key, value)
  }
  const prefs = items.get(PREFS_KEY)
  if (prefs === undefined) return
  const carried: unknown = JSON.parse(prefs)
  if (carried && typeof carried === 'object' && !Array.isArray(carried)) {
    writeStorage(PREFS_KEY, JSON.stringify({ ...carried, ...readPrefs() }))
  }
}

/* Applies a link code. Null when the hand-over is ignored: this browser already
 * received one, and the visitor did not ask for this one. */
export async function applyHandOver(
  code: string,
  requested: boolean,
  pinia: Pinia,
): Promise<HandOverResult | null> {
  if (!requested && readFlag('moved') !== null) return null
  const items = code === '' ? null : await unpackCode(code)
  if (!items) return HAND_OVER_FAILED

  const result: HandOverResult = { ok: true, teams: 0, rosters: 0, teamsLeft: 0, rostersLeft: 0 }

  const teams = useTeamLibrary(pinia)
  const held = new Map(teams.teams.map((team) => [team.id, team]))
  const teamsFile = exportFile('saved-teams', 'teams', items.get(TEAMS_KEY) ?? '[]')
  if (teamsFile) {
    const fresh = parseImport(teamsFile, teams.teams)?.accepted.length ?? 0
    result.teamsLeft = Math.max(0, fresh - (MAX_SAVED_TEAMS - teams.count))
    result.teams = teams.importTeams(teamsFile).imported
    result.ok &&= teams.persisted
  }

  const rosters = useRosters(pinia)
  const rostersFile = exportFile('rosters', 'rosters', items.get(ROSTERS_KEY) ?? '[]')
  if (rostersFile) {
    const fresh = parseRostersImport(rostersFile, rosters.rosters)?.accepted.length ?? 0
    result.rostersLeft = Math.max(0, fresh - (MAX_ROSTERS - rosters.count))
    // Import makes its first new roster the active one; a hand-over keeps the
    // pick made here, else the old address's.
    const kept = rosters.activeId
    const carried = items.get('stargazer.rosters.active')
    result.rosters = rosters.importRosters(rostersFile).imported
    result.ok &&= rosters.persisted
    const active =
      kept ?? (rosters.rosters.some((roster) => roster.id === carried) ? carried! : null)
    if (rosters.activeId !== active) rosters.setActive(active)
  }

  // Boards and settings are a convenience: a bad value is left behind rather
  // than failing the libraries' hand-over, or each other.
  for (const fill of [() => fillBoards(items, held), () => fillSettings(items)]) {
    try {
      fill()
    } catch (error) {
      console.warn('Hand-over left a board or setting behind:', error)
    }
  }

  if (result.ok) writeFlag('moved')
  return result
}
