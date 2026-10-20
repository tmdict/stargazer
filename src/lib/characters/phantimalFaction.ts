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

// Counts the heroes in a lineup whose faction is in `factions`. `factionOf`
// resolves a character's faction; it lives in the data store, so it's injected
// to keep this pure.
export function countFaction(
  heroIds: Iterable<number>,
  factions: readonly string[],
  factionOf: (characterId: number) => string | undefined,
): number {
  let count = 0
  for (const id of heroIds) {
    const faction = factionOf(id)
    if (faction !== undefined && factions.includes(faction)) count++
  }
  return count
}

// Counts distinct hero units on a team whose faction is in `factions`. Only main
// characters count: companions and phantimals are excluded.
export function countTeamFaction(
  grid: Grid,
  team: Team,
  factions: readonly string[],
  factionOf: (characterId: number) => string | undefined,
): number {
  const heroes = getTilesWithCharacters(grid).flatMap(({ team: owner, characterId }) =>
    owner === team &&
    characterId !== undefined &&
    !isPhantimalId(characterId) &&
    !isCompanionId(grid, characterId)
      ? [characterId]
      : [],
  )
  return countFaction(heroes, factions, factionOf)
}

// Whether a lineup of heroes fields enough of a phantimal's faction(s) for it.
export function lineupQualifies(
  phantimal: Pick<PhantimalType, 'faction' | 'qualifyingFactions'>,
  heroIds: Iterable<number>,
  factionOf: (characterId: number) => string | undefined,
): boolean {
  return (
    countFaction(heroIds, requiredFactions(phantimal), factionOf) >= PHANTIMAL_FACTION_REQUIREMENT
  )
}
