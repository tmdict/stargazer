/* The engine's formation for each team of a chosen set (lib/placement): its
 * heroes, the artifact the set gives it and the phantimal they can summon,
 * placed on its map from their skills, reading no recorded placement. A file
 * from another season than Stargazer's is placed as slTeamData draws it,
 * without its seasonal artifacts and phantimals, and scores no buff tile,
 * since the map files hold this season's. A map Stargazer no longer holds has
 * no formation here, and its board keeps the recorded one. */

import { toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { getMapByKey } from '@/lib/maps'
import { placeTeam } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import { artifactSurvives, isRetiredSeason } from '@/lib/seasonal'
import { loadPhantimals } from '@/utils/dataLoader'
import type { SlData, SlUnit } from '../data/types'
import { choiceSeason } from './team'
import type { SlChoice } from './types'

// One entry per board, in board order: every unit and its tile, as a recorded
// placement's c and s hold them together, or null for a map with no formation.
export function suggestedUnits(data: SlData, set: SlChoice): (SlUnit[] | null)[] {
  const retired = isRetiredSeason(data.season)
  // Each of a season's phantimals needs three heroes of its own factions, so
  // five heroes can summon one of them at most.
  const phantimals = retired ? [] : loadPhantimals()
  return set.teams.map((choice) => {
    const mapKey = data.maps[choiceSeason(data, choice).teams[choice.team]!.map]!.key
    if (!getMapByKey(mapKey)) return null
    const phantimal = phantimals.find((p) =>
      lineupQualifies(p, choice.heroes, PLACEMENT_LOOKUPS.factionOf),
    )
    const { artifact } = choice
    const { units, positions } = placeTeam(
      {
        heroes: choice.heroes,
        phantimal: phantimal && toPhantimalId(phantimal.id),
        artifact:
          artifact !== null && artifactSurvives(data.season, artifact) ? artifact : undefined,
      },
      mapKey,
      data.placement,
      PLACEMENT_LOOKUPS,
      { buffTiles: !retired },
    )
    return units.map((unit, i): SlUnit => [positions[i]!, unit])
  })
}
