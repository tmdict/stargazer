/* Match import: readings plus the user's review decisions become per-board
 * rosters the grids store can stamp, and the record name the pvp export
 * convention expects ("S7 SL5 Group - GNX > 10 (1,3,4,5 > 2)": the player
 * on the ally half of the boards first, `>` when that player won more maps,
 * each player's map numbers in the brackets). Pure data mapping, a sibling
 * of sideLoad. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { getOpposingTeam } from '@/lib/characters/character'
import type { HeroReading, ScreenshotReading } from '@/lib/import/types'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'

export const SIDES = [Team.ALLY, Team.ENEMY] as const

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
  // Mapped, but no hero on either side (nothing recognised, nothing picked).
  | { kind: 'empty'; count: number }
  // The same hero picked for two cells of one side.
  | { kind: 'duplicate-hero'; team: Team; characterId: number; mapIndex: number }
  | { kind: 'cross-board-duplicate'; team: Team; characterId: number; maps: number[] }
  | { kind: 'cross-board-artifact'; team: Team; artifactId: number; maps: number[] }
  // Map wins are equal or unknown; the record name falls back to the typed order.
  | { kind: 'result-undecided' }
  // Already on that side of a board the plan leaves untouched, so the import
  // would skip it. Found against the live boards, not by the plan builder.
  | { kind: 'retained-hero'; team: Team; characterId: number; mapIndex: number }
  | { kind: 'retained-artifact'; team: Team; artifactId: number; mapIndex: number }

export interface TeamImportPlan {
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

// An issue that would put a wrong roster on a board blocks; the others only
// leave something out, and say so.
export const isBlockingIssue = (issue: PlanIssue): boolean =>
  issue.kind === 'duplicate-map' ||
  issue.kind === 'duplicate-hero' ||
  issue.kind === 'cross-board-duplicate' ||
  issue.kind === 'cross-board-artifact'

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

/* The artifact a side contributes: the override when one was made (null =
 * removed), else the top candidate. */
export const cellArtifactId = (
  reading: ScreenshotReading,
  team: Team,
  overrides: Partial<Record<Team, number | null>>,
): number | null => {
  const override = overrides[team]
  if (override !== undefined) return override
  return reading.artifacts[team]?.candidates[0]?.artifactId ?? null
}

export type CellState = 'sure' | 'review' | 'paragon' | 'none' | 'duplicate'

/* The state the review shows for a cell. A cell removed in review has nothing
 * left to check; one nobody recognised or picked is `none`; otherwise the
 * hero and the paragon each stand once read surely or edited (a doubtful
 * frame match puts the whole card in doubt, levels included). */
export const cellState = (cell: HeroReading, override: CellOverride = {}): CellState => {
  if (override.characterId === null) return 'sure'
  if (override.characterId === undefined && !cell.recognised) return 'none'
  const heroSure = override.characterId !== undefined || cell.sure
  const paragonSure = override.paragon !== undefined || cell.paragon.sure
  if (!heroSure) return 'review'
  return paragonSure ? 'sure' : 'paragon'
}

/* Every cell's state on one side; a hero on two of its cells marks both. */
export function reviewStates(
  reading: ScreenshotReading,
  team: Team,
  overrides: Record<string, CellOverride>,
): CellState[] {
  const ids = reading.sides[team].map((_, row) => cellCharacterId(reading, team, row, overrides))
  return reading.sides[team].map((cell, row) => {
    const id = ids[row]!
    if (id !== null && ids.indexOf(id) !== ids.lastIndexOf(id)) return 'duplicate'
    return cellState(cell, overrides[overrideKey(team, row)])
  })
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
  const left = names.left.trim()
  const right = names.right.trim()
  if (!left || !right) return ''
  const leftMaps: number[] = []
  const rightMaps: number[] = []
  results.forEach((winner, i) => {
    if (winner === Team.ALLY) leftMaps.push(i + 1)
    else if (winner === Team.ENEMY) rightMaps.push(i + 1)
  })
  const op = rightMaps.length > leftMaps.length ? '<' : '>'
  const prefix = names.prefix.trim()
  const head = prefix ? `${prefix} - ` : ''
  const players = `${head}${left} ${op} ${right}`
  // A single map has nothing to list; the operator already says who won it.
  if (results.length <= 1) return players
  return `${players} (${leftMaps.join(',')} ${op} ${rightMaps.join(',')})`
}

/* `swapSides` puts every screenshot's Ally column on the enemy side of its
 * board and its Enemy column on the ally side. One choice for the whole match
 * rather than per screenshot: the game's Ally tab is the viewing player, who
 * keeps one side of the board for every map, and the boards hold a hero once
 * per side page-wide. Issues and the record name follow board sides
 * throughout. */
export function buildTeamImportPlan(
  shots: readonly ShotAssignment[],
  mode: TeamModeKey,
  names: RecordNames,
  swapSides = false,
): TeamImportPlan {
  const { boardCount } = TEAM_MODES[mode]
  const boards: (BoardRoster | null)[] = Array.from({ length: boardCount }, () => null)
  const issues: PlanIssue[] = []
  const seen = new Set<number>()
  const mapped = (mapIndex: number | null): mapIndex is number =>
    mapIndex !== null && mapIndex < boardCount
  // The screenshot column that fills a board side.
  const columnOf = (side: Team): Team => (swapSides ? getOpposingTeam(side) : side)
  // A column's board side: the swap is its own inverse.
  const sideOf = columnOf
  const unmapped = shots.filter((s) => !mapped(s.mapIndex)).length
  if (unmapped > 0) issues.push({ kind: 'unmapped', count: unmapped })
  let empty = 0

  for (const shot of shots) {
    if (!mapped(shot.mapIndex)) continue
    if (seen.has(shot.mapIndex)) {
      if (!issues.some((i) => i.kind === 'duplicate-map' && i.mapIndex === shot.mapIndex)) {
        issues.push({ kind: 'duplicate-map', mapIndex: shot.mapIndex })
      }
      continue
    }
    seen.add(shot.mapIndex)
    const sides = {} as Record<Team, RosterEntry[]>
    for (const side of SIDES) {
      const column = columnOf(side)
      const ids = shot.reading.sides[column].map((_, row) =>
        cellCharacterId(shot.reading, column, row, shot.overrides),
      )
      // The reader settles a side's five cells against each other, so a hero
      // on two cells can only come from review edits; the first cell keeps it
      // and the issue blocks until one is changed.
      const repeated = new Set(
        ids.filter((id, i): id is number => id !== null && ids.indexOf(id) !== i),
      )
      for (const characterId of repeated) {
        issues.push({ kind: 'duplicate-hero', team: side, characterId, mapIndex: shot.mapIndex })
      }
      const entries: RosterEntry[] = []
      ids.forEach((characterId, row) => {
        if (characterId === null || entries.some((e) => e.characterId === characterId)) return
        entries.push({ characterId, attrs: cellAttrs(shot.reading, column, row, shot.overrides) })
      })
      sides[side] = entries
    }
    // An empty board would only wipe what is there; the screenshot is skipped.
    if (sides[Team.ALLY].length === 0 && sides[Team.ENEMY].length === 0) {
      empty++
      continue
    }
    boards[shot.mapIndex] = {
      sides,
      artifacts: {
        ally: cellArtifactId(shot.reading, columnOf(Team.ALLY), shot.artifactOverrides),
        enemy: cellArtifactId(shot.reading, columnOf(Team.ENEMY), shot.artifactOverrides),
      },
    }
  }
  if (empty > 0) issues.push({ kind: 'empty', count: empty })

  // A hero fields once per side in a match, and so does an artifact, so the
  // same one on the same side of two boards is a misread or a foreign
  // screenshot: it blocks.
  for (const team of SIDES) {
    const heroMaps = new Map<number, number[]>()
    const artifactMaps = new Map<number, number[]>()
    const note = (where: Map<number, number[]>, id: number, map: number): void => {
      where.set(id, [...(where.get(id) ?? []), map])
    }
    boards.forEach((board, map) => {
      if (!board) return
      for (const entry of board.sides[team]) note(heroMaps, entry.characterId, map)
      const artifact = team === Team.ALLY ? board.artifacts.ally : board.artifacts.enemy
      if (artifact !== null) note(artifactMaps, artifact, map)
    })
    for (const [characterId, maps] of heroMaps) {
      if (maps.length > 1) issues.push({ kind: 'cross-board-duplicate', team, characterId, maps })
    }
    for (const [artifactId, maps] of artifactMaps) {
      if (maps.length > 1) issues.push({ kind: 'cross-board-artifact', team, artifactId, maps })
    }
  }

  // The name reads by board half (the pvp convention: the ally half's player
  // first), so a swap lists the right player first and each map's win moves
  // to the side its column fills. Equal map wins, or none read, leave the
  // winner to the listed order: said so, rather than claimed.
  const results = mapResultsFrom(shots, boardCount).map((column) =>
    column === null ? null : sideOf(column),
  )
  const sideNames = swapSides ? { ...names, left: names.right, right: names.left } : names
  const suggestedName = suggestRecordName(sideNames, results)
  const wins = (team: Team): number => results.filter((r) => r === team).length
  if (suggestedName && boards.some((b) => b !== null) && wins(Team.ALLY) === wins(Team.ENEMY)) {
    issues.push({ kind: 'result-undecided' })
  }

  return { boards, issues, suggestedName }
}
