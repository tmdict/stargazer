// A placement rule: what the placement engine wants from one effect of the unit
// whose data file holds it, when the battle starts. Where the effect lands is
// the unit's skill's to say, so a rule names only the aim, and the lists and
// weights it names are valued outside it. An effect Stargazer draws no skill
// for, such as a charm's, names its tile instead.
export type RuleTeam = 'ally' | 'enemy'

// Where an effect with no skill code acts: on the unit behind or in front of
// its holder, or on the tiles around it.
type RuleTile = 'behind' | 'front' | 'around'

export type RuleGoal =
  | { target: string }
  | { avoid: string }
  | { include: string }
  | { atMost: number }
  // sameFaction: the units counted also share one faction. nonHero: the share of
  // the goal met when a unit other than the team's heroes, such as a phantimal,
  // is among them, all of it when unset.
  | { exactly: number; sameFaction?: true; nonHero?: number }
  // A bare most counts the enemy tiles among the tiles the effect marks, walls
  // the walls on the enemy's side among them, and allies our units on them.
  | 'most'
  | { most: 'walls' | 'allies' }
  | 'none'

export interface Rule {
  team: RuleTeam
  goal: RuleGoal
  tile?: RuleTile
  // Absent only for a goal of none, which scores nothing.
  weight?: string
  note: string
}
