/* A chosen set as one encoded 5v5 Supreme League team, the same data a saved
 * team holds: the page draws its boards from it and Save as team stores it, so
 * a saved set opens on the Teams page as the page drew it. Each board stands
 * on its map's layout from the data file, so a set from a retired map still
 * draws and loads. Only the ally side is filled, with the selection's levels.
 * A file from another season than Stargazer's (the gap after a cutover) has
 * its seasonal artifacts and phantimals left out, since their ids name the new
 * season's content. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import type { MapConfig } from '@/lib/maps'
import { isPermanentArtifactId, isRetiredSeason } from '@/lib/seasonal'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { serializeMultiGridState, type BoardInput } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import type { SlChoice, SlData, SlMap, SlPick } from './types'

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

export function slTeamData(data: SlData, set: SlChoice, picks: readonly SlPick[]): string {
  const retired = isRetiredSeason(data.season)
  const levels = new Map(
    picks.map((pick): [number, AttrRecord] => [
      pick.id,
      { [ATTR_PARAGON]: pick.paragon, [ATTR_REFINEMENT]: pick.refinement },
    ]),
  )
  const boards = set.teams.map((choice): BoardInput => {
    const season = choice.source === 0 ? data : data.before!
    const team = season.teams[choice.team]!
    const { c, s } = team.placements[choice.placement]!
    const map = data.maps[team.map]!
    const grid = new Grid(FULL_GRID, mapConfig(map))
    const place = (hexId: number, unitId: number): void => {
      const tile = grid.getTileById(hexId)
      tile.characterId = unitId
      tile.team = Team.ALLY
      tile.state = State.OCCUPIED_ALLY
    }
    for (const [hexId, unitId] of c) place(hexId, unitId)
    if (!retired) for (const [hexId, local] of s) place(hexId, toPhantimalId(local))
    const artifact = choice.artifact
    return {
      tiles: grid.getAllTiles(),
      allyArtifact:
        artifact !== null && (!retired || isPermanentArtifactId(artifact)) ? artifact : null,
      enemyArtifact: null,
      map: map.key,
      getAttrs: (side, unitId) => (side === Team.ALLY ? (levels.get(unitId) ?? {}) : {}),
    }
  })
  return encodeMultiGridStateToUrl(serializeMultiGridState(boards, 0, undefined, '5v5'))
}
