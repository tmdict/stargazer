/* Team Power: each placed hero's paragon level grants its team equal Inspiration
 * and Intimidation. Because the two stats are symmetric, a team's net stat
 * modifier is its paragon total minus the enemy's (one side's Inspiration is
 * exactly the other side's Intimidation), so the two teams' nets always mirror.
 * Faction picks the ramp: Celestials and Hypogeans start from a nonzero base
 * (P0 is not "off" for them) with a shallower step, and both ramps converge to
 * the same value at PARAGON_MAX_LEVEL. */

export const PARAGON_MAX_LEVEL = 4

export interface ParagonHero {
  level: number
  faction?: string
}

const isCelestialOrHypogean = (faction?: string): boolean =>
  faction === 'celestial' || faction === 'hypogean'

export const paragonStatValue = (level: number, faction?: string): number =>
  isCelestialOrHypogean(faction) ? 4 + level * 3.5 : level * 4.5

export const teamPowerTotal = (heroes: ParagonHero[]): number =>
  heroes.reduce((sum, hero) => sum + paragonStatValue(hero.level, hero.faction), 0)

export const teamPowerNet = (allyHeroes: ParagonHero[], enemyHeroes: ParagonHero[]): number =>
  teamPowerTotal(allyHeroes) - teamPowerTotal(enemyHeroes)
