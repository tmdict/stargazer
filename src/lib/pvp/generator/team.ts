/* A chosen set as one encoded team, the same data a saved team holds: the page
 * draws its boards from it and Save as team stores it, so a saved set opens on
 * the Teams page as the page drew it. Only the ally side is filled, with the
 * selection's levels, in each board's formation (formation.ts). A file from
 * another season than Stargazer's (the gap after a cutover) has its seasonal
 * artifacts and phantimals left out, since their ids name the new season's
 * content. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import { DEFAULT_MAP_KEY, getMapByKey } from '@/lib/maps'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import { TEAM_MODE_ORDER, TEAM_MODES } from '@/lib/teams/modes'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { serializeMultiGridState, type BoardInput } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import type { SlData, SlUnit } from '../data/types'
import type { BoardFormation } from './formation'
import type { SlBoard } from './setType'
import type { SlChoice, SlChoiceTeam, SlPick } from './types'

type ChoiceOf = Pick<SlChoiceTeam, 'source' | 'team'>

// The map in the file a chosen team was recorded on, or for a row of every
// map the one where it has the most games.
export const homeMap = (data: SlData, { source, team }: ChoiceOf): number =>
  source ?? data.everyMap[team]!.home

// A team's recorded placement: its heroes and their companions, then its
// phantimal and the phantimal's companions. Null for a team whose games
// recorded no formation, or a row of every map, which the engine places.
export function recordedUnits(data: SlData, choice: SlChoiceTeam): SlUnit[] | null {
  if (choice.source === null) return null
  const placement = data.maps[choice.source]!.teams[choice.team]!.placements[choice.placement]
  if (!placement) return null
  const { c, s } = placement
  return isRetiredSeason(data.season)
    ? c
    : [...c, ...s.map(([hexId, local]): SlUnit => [hexId, toPhantimalId(local)])]
}

export function slTeamData(
  data: SlData,
  set: SlChoice,
  picks: readonly SlPick[],
  boards: readonly SlBoard[],
  formations: readonly Pick<BoardFormation, 'units'>[],
): string {
  const levels = new Map(
    picks.map((pick): [number, AttrRecord] => [
      pick.id,
      { [ATTR_PARAGON]: pick.paragon, [ATTR_REFINEMENT]: pick.refinement },
    ]),
  )
  const drawn = set.teams.map((choice, index): BoardInput => {
    const { layout } = boards[index]!
    const grid = new Grid(FULL_GRID, layout.config)
    const place = (hexId: number, unitId: number): void => {
      const tile = grid.getTileById(hexId)
      tile.characterId = unitId
      tile.team = Team.ALLY
      tile.state = State.OCCUPIED_ALLY
    }
    for (const [hexId, unitId] of formations[index]!.units) place(hexId, unitId)
    const artifact = choice.artifact
    return {
      tiles: grid.getAllTiles(),
      allyArtifact: artifact !== null && artifactSurvives(data.season, artifact) ? artifact : null,
      enemyArtifact: null,
      // A Map Editor map has no name a saved team can hold, so the team keeps
      // its tiles and loads on the default map, as a board without a map does.
      map: getMapByKey(layout.key) ? layout.key : DEFAULT_MAP_KEY,
      getAttrs: (side, unitId) => (side === Team.ALLY ? (levels.get(unitId) ?? {}) : {}),
    }
  })
  const mode = TEAM_MODE_ORDER.find((key) => TEAM_MODES[key].boardCount === drawn.length)
  return encodeMultiGridStateToUrl(serializeMultiGridState(drawn, 0, undefined, mode))
}
