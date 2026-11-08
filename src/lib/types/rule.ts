// A placement rule: what the placement engine wants from one effect of the unit
// whose data file holds it, or from where the unit stands, when the battle
// starts. Where the effect lands is the unit's skill's to say, so a rule names
// only the aim, and the lists and weights it names are valued outside it. An effect Stargazer draws no skill
// for, such as a charm's, names its tile instead.
export type RuleTeam = 'ally' | 'enemy'

// Where an effect with no skill code acts: on the unit behind or in front of
// its holder, on the tiles around it, or on the other tiles of its row.
type RuleTile = 'behind' | 'front' | 'around' | 'row'

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
  // The holder's own other body, such as Phraesto's Illusion, on the tiles.
  | 'companion'
  // The holder in the back half of the ally tiles, as a lean measures them. It
  // reads no effect, so it needs no skill.
  | 'back'
  | 'none'

export interface Rule {
  team: RuleTeam
  goal: RuleGoal
  tile?: RuleTile
  // Where a tile rule reads from: the holder's own other body in place of the
  // holder, for an effect each body gives on its own.
  from?: 'companion'
  // Absent only for a goal of none, which scores nothing.
  weight?: string
  note: string
}
