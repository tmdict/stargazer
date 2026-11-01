/* A chosen set as one encoded team, the same data a saved team holds: the page
 * draws its boards from it and Save as team stores it, so a saved set opens on
 * the Teams page as the page drew it. Each board stands on its map's layout
 * from the data file, so a set from a retired map still draws and loads. Only
 * the ally side is filled, with the selection's levels, in the recorded
 * placement or in the engine's formation (suggested.ts) where one is given.
 * A file from another season than Stargazer's (the gap after a cutover) has
 * its seasonal artifacts and phantimals left out, since their ids name the new
 * season's content. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import type { MapConfig } from '@/lib/maps'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import { TEAM_MODE_ORDER, TEAM_MODES } from '@/lib/teams/modes'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { serializeMultiGridState, type BoardInput } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import type { SlData, SlMap, SlUnit } from '../data/types'
import type { SlChoice, SlChoiceTeam, SlPick } from './types'

// The season a chosen team comes from: this season's, or the season before's.
export const choiceSeason = (data: SlData, choice: Pick<SlChoiceTeam, 'source'>) =>
  choice.source === 0 ? data : data.before!

const mapConfig = ({ key, grid }: SlMap): MapConfig => ({
  id: 0,
  name: key,
  grid: [
    { type: State.AVAILABLE_ALLY, hex: grid.ally },
    { type: State.AVAILABLE_ENEMY, hex: grid.enemy },
    { type: State.BLOCKED, hex: grid.blocked },
    { type: State.BLOCKED_BREAKABLE, hex: grid.breakable },
  ],
})

export function slTeamData(
  data: SlData,
  set: SlChoice,
  picks: readonly SlPick[],
  suggested?: readonly (SlUnit[] | null)[],
): string {
  const retired = isRetiredSeason(data.season)
  const levels = new Map(
    picks.map((pick): [number, AttrRecord] => [
      pick.id,
      { [ATTR_PARAGON]: pick.paragon, [ATTR_REFINEMENT]: pick.refinement },
    ]),
  )
  const boards = set.teams.map((choice, index): BoardInput => {
    const team = choiceSeason(data, choice).teams[choice.team]!
    const { c, s } = team.placements[choice.placement]!
    const recorded = retired
      ? c
      : [...c, ...s.map(([hexId, local]): SlUnit => [hexId, toPhantimalId(local)])]
    const map = data.maps[team.map]!
    const grid = new Grid(FULL_GRID, mapConfig(map))
    const place = (hexId: number, unitId: number): void => {
      const tile = grid.getTileById(hexId)
      tile.characterId = unitId
      tile.team = Team.ALLY
      tile.state = State.OCCUPIED_ALLY
    }
    for (const [hexId, unitId] of suggested?.[index] ?? recorded) place(hexId, unitId)
    const artifact = choice.artifact
    return {
      tiles: grid.getAllTiles(),
      allyArtifact: artifact !== null && artifactSurvives(data.season, artifact) ? artifact : null,
      enemyArtifact: null,
      map: map.key,
      getAttrs: (side, unitId) => (side === Team.ALLY ? (levels.get(unitId) ?? {}) : {}),
    }
  })
  const mode = TEAM_MODE_ORDER.find((key) => TEAM_MODES[key].boardCount === boards.length)
  return encodeMultiGridStateToUrl(serializeMultiGridState(boards, 0, undefined, mode))
}
