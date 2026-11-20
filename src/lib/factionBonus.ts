/* The game's two faction rules, as its Faction Bonus panel states them: the
 * ATK and HP a team gains from heroes of one faction, and the damage change
 * between factions that counter each other. */

// Each faction is strong against the one after it, and the last against the first.
export const TACTICS_WHEEL = ['lightbearer', 'mauler', 'wilder', 'graveborn'] as const

export const TACTICS_PERCENT = 15

export const TEAM_SIZE = 5

/** A team's ATK and HP bonus by how many heroes share a faction: `groups` is
 * the size of each same-faction group that counts. */
export const FACTION_BONUS_STEPS: readonly { groups: readonly number[]; percent: number }[] = [
  { groups: [3], percent: 10 },
  { groups: [3, 2], percent: 14 },
  { groups: [4], percent: 18 },
  { groups: [5], percent: 22 },
]

/** One faction per hero of a step's same-faction groups, each group a faction
 * of its own. */
export const stepTeam = (groups: readonly number[]): string[] =>
  groups.flatMap((size, g) => Array<string>(size).fill(TACTICS_WHEEL[g]!))

// Added per Celestial or Hypogean hero on the team, on top of the step.
export const WILD_FACTION_PERCENT = 1
export const WILD_FACTIONS = ['celestial', 'hypogean'] as const

const isWild = (faction: string): boolean => (WILD_FACTIONS as readonly string[]).includes(faction)

export interface TeamFactionBonus {
  // The step the team reaches plus its wild heroes' points, in percent.
  percent: number
  // The team's heroes by faction, the largest group first.
  counts: readonly { faction: string; count: number }[]
}

/* A team's bonus from its heroes' factions, one entry per hero, copies of a
 * hero included. A Celestial or Hypogean hero stands in for any faction, so
 * the team takes the highest step those stand-ins can complete, and each adds
 * its own point on top. */
export function teamFactionBonus(factions: readonly string[]): TeamFactionBonus {
  const tally = new Map<string, number>()
  for (const faction of factions) tally.set(faction, (tally.get(faction) ?? 0) + 1)
  const counts = [...tally]
    .map(([faction, count]) => ({ faction, count }))
    .sort((a, b) => b.count - a.count)
  const wild = factions.filter(isWild).length
  const sizes = counts.filter(({ faction }) => !isWild(faction)).map(({ count }) => count)

  // A step's largest group goes to the largest faction, and so on down: any
  // other match needs at least as many stand-ins.
  const standIns = (groups: readonly number[]): number =>
    groups.reduce((needed, size, i) => needed + Math.max(0, size - (sizes[i] ?? 0)), 0)
  const step = FACTION_BONUS_STEPS.reduce(
    (best, { groups, percent }) => (standIns(groups) <= wild ? Math.max(best, percent) : best),
    0,
  )
  return { percent: step + wild * WILD_FACTION_PERCENT, counts }
}
