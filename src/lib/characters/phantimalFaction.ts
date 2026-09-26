import type { Grid } from '../grid'
import type { PhantimalType } from '../types/phantimal'
import type { Team } from '../types/team'
import { getTilesWithCharacters } from './character'
import { isCompanionId } from './companion'
import { isPhantimalId } from './phantimal'

// A phantimal can only be on a team that fields at least this many characters of
// the phantimal's faction(s).
export const PHANTIMAL_FACTION_REQUIREMENT = 3

// Phantimals normally require their own faction; a data file's
// qualifyingFactions counts several toward the total (the season's
// hypogean/celestial phantimal draws on both).
export function requiredFactions(
  phantimal: Pick<PhantimalType, 'faction' | 'qualifyingFactions'>,
): readonly string[] {
  return phantimal.qualifyingFactions ?? [phantimal.faction]
}

// Counts distinct hero units on a team whose faction is in `factions`. Only main
// characters count: companions and phantimals are excluded. `factionOf` resolves
// a character's faction; it lives in the data store, so it's injected to keep this
// pure.
export function countTeamFaction(
  grid: Grid,
  team: Team,
  factions: readonly string[],
  factionOf: (characterId: number) => string | undefined,
): number {
  let count = 0
  for (const tile of getTilesWithCharacters(grid)) {
    if (tile.team !== team || tile.characterId === undefined) continue
    if (isPhantimalId(tile.characterId) || isCompanionId(grid, tile.characterId)) continue
    const faction = factionOf(tile.characterId)
    if (faction !== undefined && factions.includes(faction)) count++
  }
  return count
}
