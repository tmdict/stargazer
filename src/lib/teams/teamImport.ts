/* Match import: readings plus the user's review decisions become per-board
 * lineups the grids store can stamp, and the match's record name
 * ("S7 SL5 Group - GNX > 10 (1,3,4,5 > 2)": the player on the ally half of the
 * boards first, `>` when that player won more maps, each player's map numbers
 * in the brackets). An import is a match's result shots, which give both sides'
 * heroes, upgrades and artifacts, with its formation shots placing those heroes
 * on their tiles; or formation shots alone, each giving one side with the
 * levels it shows (formationImport). A formation panel shows the screenshotting
 * player's own levels, never a match's, so the two never mix. Pure data
 * mapping, a sibling of sideLoad. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { getOpposingTeam, isBaseHeroId } from '@/lib/characters/character'
import { isPhantimalId } from '@/lib/characters/phantimal'
import type { FormationReading, HeroReading, ScreenshotReading } from '@/lib/import/types'
import {
  assignUnits,
  formationSide,
  heroesFromUnits,
  identifyMap,
  SURE_SCORE,
  type PlacedUnit,
  type UnitAssignment,
} from '@/lib/teams/formationImport'
import { TEAM_MODES, variantsForMode, type TeamModeKey } from '@/lib/teams/modes'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
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

export interface FormationAssignment {
  reading: FormationReading
  // 0-based board this screenshot shows; null while unmapped.
  mapIndex: number | null
  // Review edits of its card row and artifact, used when the board has no
  // result shot; keyed like a result shot's.
  overrides: Record<string, CellOverride>
  artifactOverrides: Partial<Record<Team, number | null>>
  // Review picks for its units, by index in the reading: a unit id, or null
  // for a portrait that is none of the side's units.
  unitOverrides: Record<number, number | null>
}

export interface ReplayAssignment {
  // 0-based board this replay frame shows; null while unmapped.
  mapIndex: number | null
  // By board side, the unit picked as starting on each tile, by hex id.
  picks: Partial<Record<Team, Readonly<Record<number, number>>>>
}

export interface LineupEntry {
  characterId: number
  attrs: AttrRecord
}

export interface BoardLineup {
  // The sides the import fills, as the side-load places them; a side no
  // screenshot shows stays empty on the new team.
  sides: Partial<Record<Team, SideLoadBoard>>
  // Sides whose phantimal is the one a screenshot shows (or none); another
  // side gets the phantimal its lineup qualifies for.
  formations: Team[]
  // The map the board's formation shots show; null to keep the board's own.
  map: string | null
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
  // Two formation shots of the same side of one board.
  | { kind: 'duplicate-formation'; team: Team; mapIndex: number }
  // A board's formation shots show different maps.
  | { kind: 'map-conflict'; mapIndex: number }
  // A formation shot's tiles are no map of the mode's. The board takes the map
  // of its other formation shot when that one has a map, else keeps its own.
  | { kind: 'unknown-map'; mapIndex: number; keepsMap: boolean }
  // Heroes of the lineup with no portrait on the formation shot, which take
  // random free tiles.
  | { kind: 'unplaced'; team: Team; mapIndex: number; count: number }
  // In a match import, a formation shot of a map with no result shot: it has
  // no match heroes to place, and is left out.
  | { kind: 'formation-unused'; team: Team; mapIndex: number }
  // Two replay frames of one board.
  | { kind: 'duplicate-replay'; mapIndex: number }
  // A replay frame of a map with no result shot, left out like a formation shot.
  | { kind: 'replay-unused'; mapIndex: number }

export interface TeamImportPlan {
  // One entry per board; null leaves that board untouched.
  boards: (BoardLineup | null)[]
  issues: PlanIssue[]
  suggestedName: string
  // Per formation shot, in the order given: who each of its units is taken for.
  units: UnitAssignment[][]
  // Whether each result column fills the opposite board side, and whether the
  // formation shots settled it (else the `swapSides` passed in did). Formation
  // shots alone have no result columns, so neither is ever set for them.
  sidesSwapped: boolean
  sidesFromFormations: boolean
}

export interface RecordNames {
  prefix: string
  left: string
  right: string
}

export const overrideKey = (team: Team, row: number): string => `${team}:${row}`

// An issue that would put a wrong lineup on a board blocks; the others only
// leave something out, and say so.
export const isBlockingIssue = (issue: PlanIssue): boolean =>
  issue.kind === 'duplicate-map' ||
  issue.kind === 'duplicate-hero' ||
  issue.kind === 'cross-board-duplicate' ||
  issue.kind === 'cross-board-artifact' ||
  issue.kind === 'duplicate-formation' ||
  issue.kind === 'duplicate-replay' ||
  issue.kind === 'map-conflict'

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

const columnIds = (
  reading: ScreenshotReading,
  team: Team,
  overrides: Record<string, CellOverride>,
): (number | null)[] =>
  reading.sides[team].map((_, row) => cellCharacterId(reading, team, row, overrides))

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

/* Whether a side's artifact still needs a look: settled once edited (a pick,
 * a confirmation or a removal) or read surely; a side with no reading has
 * nothing to check. */
export const artifactState = (
  reading: ScreenshotReading,
  team: Team,
  overrides: Partial<Record<Team, number | null>>,
): 'sure' | 'review' => {
  if (overrides[team] !== undefined) return 'sure'
  const artifact = reading.artifacts[team]
  return !artifact || artifact.sure ? 'sure' : 'review'
}

export type CellState = 'sure' | 'review' | 'paragon' | 'refinement' | 'none' | 'duplicate'

/* The state the review shows for a cell. A cell removed in review has nothing
 * left to check; one nobody recognised or picked is `none`; otherwise the
 * hero, the paragon and the refinement each stand once read surely or edited,
 * asked about in that order (a doubtful frame match puts the whole card in
 * doubt, levels included). */
export const cellState = (cell: HeroReading, override: CellOverride = {}): CellState => {
  if (override.characterId === null) return 'sure'
  if (override.characterId === undefined && !cell.recognised) return 'none'
  const heroSure = override.characterId !== undefined || cell.sure
  const paragonSure = override.paragon !== undefined || cell.paragon.sure
  const refinementSure = override.refinement !== undefined || cell.refinement.sure
  if (!heroSure) return 'review'
  if (!paragonSure) return 'paragon'
  return refinementSure ? 'sure' : 'refinement'
}

/* Every cell's state on one side; a hero on two of its cells marks both. */
export function reviewStates(
  reading: ScreenshotReading,
  team: Team,
  overrides: Record<string, CellOverride>,
): CellState[] {
  const ids = columnIds(reading, team, overrides)
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

// The maps a board of the mode can stand on, the ones its lists put at that
// board first: what a formation shot's tiles are matched against.
const mapCandidates = (mode: TeamModeKey, mapIndex: number): string[] => {
  const lists = [...variantsForMode(mode).map((v) => v.maps), TEAM_MODES[mode].defaultMaps]
  const here = lists.flatMap((maps) => (maps[mapIndex] === undefined ? [] : [maps[mapIndex]!]))
  return [...new Set([...here, ...lists.flat()])]
}

// A side's heroes from one column of a reading, in card order: each cell's
// hero once, with its upgrades; a hero on two cells is reported.
function columnLineup(
  reading: ScreenshotReading,
  column: Team,
  overrides: Record<string, CellOverride>,
  repeated: (characterId: number) => void,
): LineupEntry[] {
  const ids = columnIds(reading, column, overrides)
  // The reader settles a side's five cells against each other, so a hero on
  // two cells can only come from review edits; the first cell keeps it and
  // the issue blocks until one is changed.
  const repeats = ids.filter((id, i): id is number => id !== null && ids.indexOf(id) !== i)
  for (const id of new Set(repeats)) repeated(id)
  const entries: LineupEntry[] = []
  ids.forEach((characterId, row) => {
    if (characterId === null || entries.some((e) => e.characterId === characterId)) return
    entries.push({ characterId, attrs: cellAttrs(reading, column, row, overrides) })
  })
  return entries
}

/* Whether a match's sides are swapped, as its formation shots show. A shot
 * stands its team on the half it fought from, and its portraits are one
 * result column's heroes. Each portrait read surely as a hero counts for a
 * swap when only the column across the board from its half holds that hero,
 * and against one when only its own half's column does; the match goes the
 * way more portraits count, so a shot mapped to the wrong board, which can
 * match a lineup only by chance, weighs little. Null when they go neither
 * way, as with no formation shot of a map with a result shot, or lineups too
 * alike to tell. */
function formationsSwapped(
  results: ReadonlyMap<number, ShotAssignment>,
  formations: readonly FormationAssignment[],
): boolean | null {
  let lean = 0
  for (const { reading, mapIndex } of formations) {
    const result = mapIndex === null ? undefined : results.get(mapIndex)
    if (!result || reading.side === null) continue
    const own = columnIds(result.reading, reading.side, result.overrides)
    const across = columnIds(result.reading, getOpposingTeam(reading.side), result.overrides)
    for (const unit of reading.units) {
      // A phantimal or companion portrait still has a weak best hero, which
      // says nothing of the lineups.
      const top = unit.candidates[0]
      if (!top || !isBaseHeroId(top.characterId) || top.score < SURE_SCORE) continue
      lean += Number(across.includes(top.characterId)) - Number(own.includes(top.characterId))
    }
  }
  return lean === 0 ? null : lean > 0
}

/* A swap puts every result shot's Ally column on the enemy side of its board
 * and its Enemy column on the ally side: the game's Ally tab is the viewing
 * player whichever half they fought from. Formation shots and replay frames
 * show each team on the half it fought from, so they keep their half and
 * tiles, and a swap only changes which column's lineup each of them takes.
 * The formation shots settle the swap when they tell it, else `swapSides`
 * does. One choice for the whole match rather than per screenshot: a player
 * keeps one side of the board for every map, and the boards hold a hero once
 * per side page-wide. Issues and the record name follow board sides
 * throughout. A replay frame places a side the way a formation shot does,
 * from the tiles picked on it, for a side no formation shot shows. */
export function buildTeamImportPlan(
  shots: readonly ShotAssignment[],
  mode: TeamModeKey,
  names: RecordNames,
  swapSides = false,
  formations: readonly FormationAssignment[] = [],
  replays: readonly ReplayAssignment[] = [],
  // Whether result screenshots make this a match, counting unread ones.
  matchImport = shots.length > 0,
): TeamImportPlan {
  const { boardCount } = TEAM_MODES[mode]
  const boards: (BoardLineup | null)[] = Array.from({ length: boardCount }, () => null)
  const issues: PlanIssue[] = []
  const mapped = (mapIndex: number | null): mapIndex is number =>
    mapIndex !== null && mapIndex < boardCount
  // A formation shot without a board has nothing to place and says so on its card.
  const placeable = formations.filter((f) => f.reading.side !== null)
  const unmapped =
    shots.filter((s) => !mapped(s.mapIndex)).length +
    placeable.filter((f) => !mapped(f.mapIndex)).length +
    replays.filter((r) => !mapped(r.mapIndex)).length
  if (unmapped > 0) issues.push({ kind: 'unmapped', count: unmapped })

  const resultShots = new Map<number, ShotAssignment>()
  for (const shot of shots) {
    if (!mapped(shot.mapIndex)) continue
    if (resultShots.has(shot.mapIndex)) {
      if (!issues.some((i) => i.kind === 'duplicate-map' && i.mapIndex === shot.mapIndex)) {
        issues.push({ kind: 'duplicate-map', mapIndex: shot.mapIndex })
      }
      continue
    }
    resultShots.set(shot.mapIndex, shot)
  }
  // Formation shots alone have no result columns to swap.
  const formationSwap = matchImport ? formationsSwapped(resultShots, placeable) : null
  const sidesSwapped = matchImport && (formationSwap ?? swapSides)
  // The result column that fills a board side.
  const columnOf = (side: Team): Team => (sidesSwapped ? getOpposingTeam(side) : side)
  // A result column's board side: the swap is its own inverse.
  const sideOf = columnOf
  const shown = new Map<number, Partial<Record<Team, FormationAssignment>>>()
  for (const formation of placeable) {
    if (!mapped(formation.mapIndex)) continue
    const team = formation.reading.side!
    const board = shown.get(formation.mapIndex) ?? {}
    if (board[team]) {
      issues.push({ kind: 'duplicate-formation', team, mapIndex: formation.mapIndex })
      continue
    }
    shown.set(formation.mapIndex, { ...board, [team]: formation })
  }
  const replayed = new Map<number, ReplayAssignment>()
  for (const replay of replays) {
    if (!mapped(replay.mapIndex)) continue
    if (replayed.has(replay.mapIndex)) {
      if (!issues.some((i) => i.kind === 'duplicate-replay' && i.mapIndex === replay.mapIndex)) {
        issues.push({ kind: 'duplicate-replay', mapIndex: replay.mapIndex })
      }
      continue
    }
    replayed.set(replay.mapIndex, replay)
  }

  const units: UnitAssignment[][] = formations.map(() => [])
  let empty = 0
  for (let mapIndex = 0; mapIndex < boardCount; mapIndex++) {
    const result = resultShots.get(mapIndex)
    const board = shown.get(mapIndex) ?? {}
    const replay = replayed.get(mapIndex)
    if (!result && replay) issues.push({ kind: 'replay-unused', mapIndex })
    if (matchImport && !result) {
      for (const team of SIDES) {
        if (board[team]) issues.push({ kind: 'formation-unused', team, mapIndex })
      }
      continue
    }
    // Sides placed from what a screenshot shows keep the phantimal shown.
    const shownSides: Team[] = SIDES.filter((side) => board[side] !== undefined)
    if (!result && !board[Team.ALLY] && !board[Team.ENEMY]) continue
    const sides: Partial<Record<Team, SideLoadBoard>> = {}
    for (const side of SIDES) {
      const formation = board[side]
      if (!result && !formation) continue
      const repeated = (characterId: number): void => {
        issues.push({ kind: 'duplicate-hero', team: side, characterId, mapIndex })
      }
      // Heroes, upgrades and artifact: the result shot's column, else (formation
      // shots alone) the formation shot's own card row, which may be missing.
      const source = result
        ? { ...result, column: columnOf(side) }
        : { ...formation!, column: formation!.reading.side! }
      const lineup =
        source.reading.sides[source.column].length > 0
          ? columnLineup(source.reading, source.column, source.overrides, repeated)
          : null
      const artifact = cellArtifactId(source.reading, source.column, source.artifactOverrides)
      if (!formation && replay) {
        // A pick of a unit the lineup does not field, left from before a swap,
        // places nothing.
        const seen: PlacedUnit[] = Object.entries(replay.picks[side] ?? {}).map(
          ([hexId, unitId]) => ({ unitId, hexId: Number(hexId) }),
        )
        const placed = formationSide(seen, lineup ?? [], artifact)
        const missing = placed.mains.filter((unit) => unit.hexId === undefined).length
        if (missing > 0) issues.push({ kind: 'unplaced', team: side, mapIndex, count: missing })
        // A phantimal left unpicked comes from the lineup, as without a replay.
        if (seen.some((u) => u.unitId !== null && isPhantimalId(u.unitId))) shownSides.push(side)
        sides[side] = placed
        continue
      }
      if (!formation) {
        sides[side] = {
          mains: (lineup ?? []).map(({ characterId, attrs }) => ({ unitId: characterId, attrs })),
          companions: [],
          phantimal: null,
          artifact,
        }
        continue
      }
      const { reading, unitOverrides } = formation
      // Without a lineup the portraits name the heroes, at their lowest upgrades.
      const heroes =
        lineup ??
        [
          ...new Set([
            ...heroesFromUnits(reading.units),
            ...Object.values(unitOverrides).filter(
              (id): id is number => id !== null && isBaseHeroId(id),
            ),
          ]),
        ].map((characterId) => ({ characterId, attrs: {} }))
      const assignments = assignUnits(
        reading.units,
        heroes.map((h) => h.characterId),
        unitOverrides,
      )
      units[formations.indexOf(formation)] = assignments
      const seen = reading.units.map((unit, i) => ({
        unitId: assignments[i]?.unitId ?? null,
        hexId: unit.hexId,
      }))
      const placed = formationSide(seen, heroes, artifact)
      const missing = placed.mains.filter((unit) => unit.hexId === undefined).length
      if (missing > 0) issues.push({ kind: 'unplaced', team: side, mapIndex, count: missing })
      sides[side] = placed
    }

    // An empty board would only wipe what is there; the screenshots are skipped.
    if (Object.values(sides).every((side) => side.mains.length === 0)) {
      empty++
      continue
    }
    const found = Object.values(board).map((formation) =>
      identifyMap(formation.reading, mapCandidates(mode, mapIndex)),
    )
    const maps = new Set(found.filter((map) => map !== null))
    if (found.includes(null)) {
      issues.push({ kind: 'unknown-map', mapIndex, keepsMap: maps.size === 0 })
    }
    if (maps.size > 1) issues.push({ kind: 'map-conflict', mapIndex })
    boards[mapIndex] = {
      sides,
      formations: shownSides,
      map: maps.size === 1 ? [...maps][0]! : null,
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
      const side = board?.sides[team]
      if (!side) return
      for (const unit of side.mains) note(heroMaps, unit.unitId, map)
      if (side.artifact !== null) note(artifactMaps, side.artifact, map)
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
  const sideNames = sidesSwapped ? { ...names, left: names.right, right: names.left } : names
  // Formation shots alone are no match record.
  const suggestedName = matchImport ? suggestRecordName(sideNames, results) : ''

  const wins = (team: Team): number => results.filter((r) => r === team).length
  if (suggestedName && boards.some((b) => b !== null) && wins(Team.ALLY) === wins(Team.ENEMY)) {
    issues.push({ kind: 'result-undecided' })
  }

  return {
    boards,
    issues,
    suggestedName,
    units,
    sidesSwapped,
    sidesFromFormations: formationSwap !== null,
  }
}
