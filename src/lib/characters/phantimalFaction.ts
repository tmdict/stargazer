import type { Grid } from '../grid'
import type { Team } from '../types/team'
import { getTilesWithCharacters } from './character'
import { isCompanionId } from './companion'
import { isPhantimalId } from './phantimal'

// A phantimal can only be on a team that fields at least this many characters of
// the phantimal's faction(s).
export const PHANTIMAL_FACTION_REQUIREMENT = 3

// Phantimals normally require their own faction. Overrides (keyed by phantimal
// name) count several factions toward the total, e.g. midnight-hunter draws on
// both hypogean and celestial.
const FACTION_OVERRIDES: Record<string, readonly string[]> = {
  'midnight-hunter': ['hypogean', 'celestial'],
}

export function requiredFactions(name: string, faction: string): readonly string[] {
  return FACTION_OVERRIDES[name] ?? [faction]
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
