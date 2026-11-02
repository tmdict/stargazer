import { toBaseHeroId } from '../characters/character'
import { inPhantimalBand, phantimalOwnerId } from '../characters/phantimal'
import type { Grid } from '../grid'
import { artifactTargetArrows } from '../skills/artifact'
import type { SkillContext, SkillManager } from '../skills/skill'
import { findUnitBehind, findUnitInFront } from '../skills/utils/targeting'
import type { Rule } from '../types/rule'
import type { Team } from '../types/team'

// Where an effect acts as the board stands: the tiles it lands on, a target
// and its arrows, and the tiles it marks.
export interface Reach {
  landed: number[]
  marked: number[]
}

// The unit a rule counts: a companion as its hero, a phantimal's companion as
// its phantimal.
export const ruleUnit = (unitId: number): number =>
  inPhantimalBand(unitId) ? phantimalOwnerId(unitId) : toBaseHeroId(unitId)

export function skillReach(manager: SkillManager, unit: number, team: Team): Reach {
  const target = manager.getSkillTarget(unit, team)
  const landed = target?.metadata?.arrows?.map((arrow) => arrow.toHexId) ?? []
  if (target?.targetHexId != null) landed.push(target.targetHexId)
  return { landed, marked: manager.getMarkedTiles(unit, team) }
}

export function charmReach(holder: SkillContext, tile: NonNullable<Rule['tile']>): Reach {
  const found = (tile === 'behind' ? findUnitBehind : findUnitInFront)(holder)?.targetHexId
  return { landed: found == null ? [] : [found], marked: [] }
}

export function artifactReach(grid: Grid, team: Team, name: string): Reach {
  return {
    landed: artifactTargetArrows(grid, team, name).map((arrow) => arrow.toHex.getId()),
    marked: [],
  }
}
