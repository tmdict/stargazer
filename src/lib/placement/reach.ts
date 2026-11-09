import { toBaseHeroId } from '../characters/character'
import { inPhantimalBand, phantimalOwnerId } from '../characters/phantimal'
import type { Grid } from '../grid'
import type { Hex } from '../hex'
import { artifactTargetArrows } from '../skills/artifact'
import type { SkillContext, SkillManager } from '../skills/skill'
import { getSymmetricalHexId } from '../skills/utils/symmetry'
import { findUnitBehind, findUnitInFront } from '../skills/utils/targeting'
import type { Rule } from '../types/rule'
import { State } from '../types/state'
import { Team } from '../types/team'

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

// The hexes within `distance` of `center`, ring by ring outward, its own left out.
function hexesAround(center: Hex, distance: number): Hex[] {
  const seen = new Set([`${center.q},${center.r}`])
  const found: Hex[] = []
  let ring = [center]
  for (let step = 0; step < distance; step++) {
    ring = ring
      .flatMap((hex) => hex.getNeighbors())
      .filter((hex) => {
        const key = `${hex.q},${hex.r}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    found.push(...ring)
  }
  return found
}

export function tileReach(
  holder: SkillContext,
  { tile, distance = 1 }: Pick<Rule, 'tile' | 'distance'>,
): Reach {
  const { grid, hexId } = holder
  if (tile === 'around') {
    return {
      landed: [],
      marked: hexesAround(grid.getHexById(hexId), distance).flatMap(
        (hex) => grid.getTileOrUndefined(hex)?.hex.getId() ?? [],
      ),
    }
  }
  // A unit on its own side's tiles next to the holder swaps with the unit on
  // the tile mirroring its own, as Reinier's skill mirrors them.
  if (tile === 'mirror-around') {
    const own =
      holder.team === Team.ALLY
        ? [State.AVAILABLE_ALLY, State.OCCUPIED_ALLY]
        : [State.AVAILABLE_ENEMY, State.OCCUPIED_ENEMY]
    return {
      landed: [],
      marked: grid
        .getHexById(hexId)
        .getNeighbors()
        .flatMap((hex) => {
          const next = grid.getTileOrUndefined(hex)
          if (!next || !own.includes(next.state)) return []
          return getSymmetricalHexId(grid, next.hex.getId()) ?? []
        }),
    }
  }
  if (tile === 'row') {
    const row = grid.getHexById(hexId).getDiagonal()
    return {
      landed: [],
      marked: grid
        .getAllTiles()
        .filter(({ hex }) => hex.getDiagonal() === row && hex.getId() !== hexId)
        .map(({ hex }) => hex.getId()),
    }
  }
  const found = (tile === 'behind' ? findUnitBehind : findUnitInFront)(holder)?.targetHexId
  return { landed: found == null ? [] : [found], marked: [] }
}

export function artifactReach(grid: Grid, team: Team, name: string): Reach {
  return {
    landed: artifactTargetArrows(grid, team, name).map((arrow) => arrow.toHex.getId()),
    marked: [],
  }
}
