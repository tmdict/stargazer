/* Match import: readings plus the user's review decisions become per-board
 * rosters the grids store can stamp, and the record name the pvp export
 * convention expects ("S7 SL5 Group - GNX > 10 (1,3,4,5 > 2)": the left
 * player is the ally half, `>` when that player won more maps, each side's
 * map numbers in the brackets). Pure data mapping, a sibling of sideLoad. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import type { ScreenshotReading } from '@/lib/import/types'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'

export interface CellOverride {
  characterId?: number | null
  paragon?: number
  refinement?: number
}

export interface ShotAssignment {
  reading: ScreenshotReading
  // 0-based board this screenshot fills; null while unmapped.
  mapIndex: number | null
  // Who won this map as reviewed (the reading's tab colour until edited).
  winner: Team | null
  // Review edits, keyed by `${team}:${row}`.
  overrides: Record<string, CellOverride>
  artifactOverrides: Partial<Record<Team, number | null>>
}

export interface RosterEntry {
  characterId: number
  attrs: AttrRecord
}

export interface BoardRoster {
  sides: Record<Team, RosterEntry[]>
  artifacts: { ally: number | null; enemy: number | null }
}

export type PlanIssue =
  | { kind: 'duplicate-map'; mapIndex: number }
  | { kind: 'unmapped'; count: number }
  | { kind: 'cross-board-duplicate'; team: Team; characterId: number; maps: number[] }

export interface TeamImportPlan {
  mode: TeamModeKey
  // One entry per board; null leaves that board untouched.
  boards: (BoardRoster | null)[]
  issues: PlanIssue[]
  suggestedName: string
}

export interface RecordNames {
  prefix: string
  left: string
  right: string
}

export const overrideKey = (team: Team, row: number): string => `${team}:${row}`

// Names sit between the operator and the brackets of the record name, so
// those four characters are the only ones a name cannot carry.
export const NAME_FORBIDDEN = /[<>()]/

/* The hero a cell contributes: the override when one was made (null =
 * removed), else the top candidate. */
export const cellCharacterId = (
  reading: ScreenshotReading,
  team: Team,
  row: number,
  overrides: Record<string, CellOverride>,
): number | null => {
  const override = overrides[overrideKey(team, row)]
  if (override && override.characterId !== undefined) return override.characterId
  const cell = reading.sides[team][row]
  return cell?.recognised ? (cell.candidates[0]?.characterId ?? null) : null
}

const cellAttrs = (
  reading: ScreenshotReading,
  team: Team,
  row: number,
  overrides: Record<string, CellOverride>,
): AttrRecord => {
  const cell = reading.sides[team][row]
  const override = overrides[overrideKey(team, row)] ?? {}
  const attrs: AttrRecord = {}
  const paragon = override.paragon ?? cell?.paragon.level ?? 0
  const refinement = override.refinement ?? cell?.refinement.level ?? 0
  if (paragon) attrs[ATTR_PARAGON] = paragon
  if (refinement) attrs[ATTR_REFINEMENT] = refinement
  return attrs
}

const cellArtifact = (shot: ShotAssignment, team: Team): number | null => {
  const override = shot.artifactOverrides[team]
  if (override !== undefined) return override
  return shot.reading.artifacts[team]?.candidates[0]?.artifactId ?? null
}

/* Who won each map, as far as the screenshots say: a mapped screenshot's own
 * result first, then the strip badges of every screenshot by majority. */
export function mapResultsFrom(
  shots: readonly ShotAssignment[],
  mapCount: number,
): (Team | null)[] {
  return Array.from({ length: mapCount }, (_, map) => {
    const own = shots.find((s) => s.mapIndex === map && s.winner !== null)
    if (own) return own.winner
    let left = 0
    let right = 0
    for (const s of shots) {
      const badge = s.reading.mapResults[map]
      if (badge === Team.ALLY) left++
      else if (badge === Team.ENEMY) right++
    }
    if (left === right) return null
    return left > right ? Team.ALLY : Team.ENEMY
  })
}

export function suggestRecordName(names: RecordNames, results: readonly (Team | null)[]): string {
  const leftMaps: number[] = []
  const rightMaps: number[] = []
  results.forEach((winner, i) => {
    if (winner === Team.ALLY) leftMaps.push(i + 1)
    else if (winner === Team.ENEMY) rightMaps.push(i + 1)
  })
  const op = rightMaps.length > leftMaps.length ? '<' : '>'
  const prefix = names.prefix.trim()
  const head = prefix ? `${prefix} - ` : ''
  return `${head}${names.left.trim()} ${op} ${names.right.trim()} (${leftMaps.join(',')} ${op} ${rightMaps.join(',')})`
}

export function buildTeamImportPlan(
  shots: readonly ShotAssignment[],
  mode: TeamModeKey,
  names: RecordNames,
): TeamImportPlan {
  const { boardCount } = TEAM_MODES[mode]
  const boards: (BoardRoster | null)[] = Array.from({ length: boardCount }, () => null)
  const issues: PlanIssue[] = []
  const seen = new Map<number, ShotAssignment>()
  const unmapped = shots.filter((s) => s.mapIndex === null).length
  if (unmapped > 0) issues.push({ kind: 'unmapped', count: unmapped })

  for (const shot of shots) {
    if (shot.mapIndex === null || shot.mapIndex >= boardCount) continue
    if (seen.has(shot.mapIndex)) {
      if (!issues.some((i) => i.kind === 'duplicate-map' && i.mapIndex === shot.mapIndex)) {
        issues.push({ kind: 'duplicate-map', mapIndex: shot.mapIndex })
      }
      continue
    }
    seen.set(shot.mapIndex, shot)
    const sides = {} as Record<Team, RosterEntry[]>
    for (const team of [Team.ALLY, Team.ENEMY]) {
      const entries: RosterEntry[] = []
      shot.reading.sides[team].forEach((_, row) => {
        const characterId = cellCharacterId(shot.reading, team, row, shot.overrides)
        if (characterId === null || entries.some((e) => e.characterId === characterId)) return
        entries.push({ characterId, attrs: cellAttrs(shot.reading, team, row, shot.overrides) })
      })
      sides[team] = entries
    }
    boards[shot.mapIndex] = {
      sides,
      artifacts: { ally: cellArtifact(shot, Team.ALLY), enemy: cellArtifact(shot, Team.ENEMY) },
    }
  }

  // A hero fields once per side in a match, so the same hero on the same
  // side of two boards is a misread or a foreign screenshot: it blocks.
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const where = new Map<number, number[]>()
    boards.forEach((board, map) => {
      for (const entry of board?.sides[team] ?? []) {
        where.set(entry.characterId, [...(where.get(entry.characterId) ?? []), map])
      }
    })
    for (const [characterId, maps] of where) {
      if (maps.length > 1) issues.push({ kind: 'cross-board-duplicate', team, characterId, maps })
    }
  }

  return {
    mode,
    boards,
    issues,
    suggestedName: suggestRecordName(names, mapResultsFrom(shots, boardCount)),
  }
}
