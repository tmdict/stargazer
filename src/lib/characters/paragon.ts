/* Team Power: each placed hero's paragon level grants its team equal Inspiration
 * and Intimidation. Because the two stats are symmetric, a team's net stat
 * modifier is its paragon total minus the enemy's (one side's Inspiration is
 * exactly the other side's Intimidation), so the two teams' nets always mirror.
 * Levels run from 0 (off) to PARAGON_MAX_LEVEL. */

export const PARAGON_MAX_LEVEL = 4

// Inspiration / Intimidation points granted per paragon level.
export const PARAGON_STEP = 4.5

export const paragonStatValue = (level: number): number => level * PARAGON_STEP

export const teamPowerTotal = (levels: number[]): number =>
  levels.reduce((sum, level) => sum + paragonStatValue(level), 0)

export const teamPowerNet = (allyLevels: number[], enemyLevels: number[]): number =>
  teamPowerTotal(allyLevels) - teamPowerTotal(enemyLevels)
