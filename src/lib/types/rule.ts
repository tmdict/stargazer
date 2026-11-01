// A placement rule: what the placement engine wants from one effect of the unit
// whose data file holds it, when the battle starts. Where the effect lands is
// always the unit's skill's to say, so a rule names only the aim, and the lists
// and weights it names are valued outside it.
export type RuleTeam = 'ally' | 'enemy'

// The place a charm acts on, for a unit no skill places.
export type RuleTile = 'behind' | 'front'

export type RuleGoal =
  | { target: string }
  | { avoid: string }
  | { include: string }
  | { atMost: number }
  // sameFaction: the units counted also share one faction.
  | { exactly: number; sameFaction?: true }
  // A bare most counts the enemy tiles among the tiles the effect marks, and
  // walls the walls on the enemy's side among them.
  | 'most'
  | { most: 'walls' }
  | 'none'

export interface Rule {
  team: RuleTeam
  goal: RuleGoal
  tile?: RuleTile
  // Absent only for a goal of none, which scores nothing.
  weight?: string
  note: string
}
