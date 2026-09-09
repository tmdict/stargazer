/* Team Power: each placed hero's paragon level grants its team equal Inspiration
 * and Intimidation. Because the two stats are symmetric, a team's net stat
 * modifier is its paragon total minus the enemy's (one side's Inspiration is
 * exactly the other side's Intimidation), so the two teams' nets always mirror.
 * The per-level values are the rivalry ramp in upgradeStats. */

import { PARAGON_RAMPS, paragonGroup, rampValue } from './upgradeStats'

export interface ParagonHero {
  level: number
  faction?: string
}

export const paragonStatValue = (level: number, faction?: string): number =>
  rampValue(PARAGON_RAMPS[paragonGroup(faction)].rivalry, level)

export const teamPowerTotal = (heroes: ParagonHero[]): number =>
  heroes.reduce((sum, hero) => sum + paragonStatValue(hero.level, hero.faction), 0)

export const teamPowerNet = (allyHeroes: ParagonHero[], enemyHeroes: ParagonHero[]): number =>
  teamPowerTotal(allyHeroes) - teamPowerTotal(enemyHeroes)
