import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { getCompanions, repositionCompanions } from '@/lib/characters/companion'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'

/* The closest-target map seeds every namespaced unit's range (companion, synergy
 * copy, phantimal) so it paths with its real reach instead of melee. arena1 has
 * no blocked tiles, so a unit's distance is its hex distance to the enemy minus
 * its range, floored at 0: ally 16 sits 2 hexes from enemy 30, one move for a
 * melee unit and in reach for anything with range 2 or more. */
const ALLY_NEAR = 16
const ALLY_FAR = 13
const ENEMY = 30
const ZANIE = 89 // turrets: companionRange 3
const DUMMY = 601 // skill-less
const DUMMY_2 = 602 // skill-less

describe('createGridContext closest-target ranges', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('seeds a companion with its skill range', () => {
    const grids = useGrids()
    grids.setGridCount(1)
    const ctx = grids.active!
    expect(ctx.place(ENEMY, DUMMY, Team.ENEMY)).toBe(true)
    expect(ctx.place(1, ZANIE, Team.ALLY)).toBe(true)

    // Turrets spawn on random tiles; settle them where the geometry is known.
    const [near, far] = [...getCompanions(ctx.grid, ZANIE, Team.ALLY)]
    repositionCompanions(ctx.grid, Team.ALLY, [
      { companionId: near!, hexId: ALLY_NEAR },
      { companionId: far!, hexId: ALLY_FAR },
    ])

    expect(ctx.closestEnemyMap.get(ALLY_NEAR)).toEqual({ enemyHexId: ENEMY, distance: 0 })
  })
})

/* Artifact arrows are derived from the slot and the board, so every placement
 * change and slot change must show up without any wiring in the operations. */
describe('createGridContext artifact arrows', () => {
  const ENLIGHTENING = 3 // rearmost ally

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('follows the slot and the board', () => {
    const grids = useGrids()
    grids.setGridCount(1)
    const ctx = grids.active!
    const targets = () => ctx.artifactArrows.map((arrow) => arrow.toHex.getId())

    ctx.setArtifact(Team.ALLY, ENLIGHTENING)
    expect(targets()).toEqual([])

    expect(ctx.place(ALLY_NEAR, DUMMY, Team.ALLY)).toBe(true)
    expect(ctx.place(ALLY_FAR, DUMMY_2, Team.ALLY)).toBe(true)
    expect(targets()).toEqual([ALLY_FAR])
    expect(ctx.artifactArrows[0]?.team).toBe(Team.ALLY)

    expect(ctx.move(ALLY_FAR, 12, DUMMY_2)).toBe(true)
    expect(targets()).toEqual([12])

    expect(ctx.remove(12)).toBe(true)
    expect(targets()).toEqual([ALLY_NEAR])

    ctx.removeArtifact(Team.ALLY)
    expect(targets()).toEqual([])
  })
})

/* Paragon levels are keyed by team + character, and a move or swap can change a
 * unit's team (the destination zone decides), so the ctx wrappers must re-key
 * the level; the engine underneath is paragon-agnostic. arena1 enemy spawns
 * include hex 40. */
describe('createGridContext paragon re-keying', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const setup = () => {
    const grids = useGrids()
    grids.setGridCount(1)
    return grids.active!
  }

  it('keeps a level on a same-team move', () => {
    const ctx = setup()
    expect(ctx.place(1, DUMMY, Team.ALLY)).toBe(true)
    ctx.setParagon(Team.ALLY, DUMMY, 3)

    expect(ctx.move(1, 2, DUMMY)).toBe(true)

    expect(ctx.getParagon(Team.ALLY, DUMMY)).toBe(3)
  })

  it('re-keys a level to the destination team on a cross-team move', () => {
    const ctx = setup()
    expect(ctx.place(1, DUMMY, Team.ALLY)).toBe(true)
    ctx.setParagon(Team.ALLY, DUMMY, 3)

    expect(ctx.move(1, 40, DUMMY)).toBe(true)

    expect(ctx.getParagon(Team.ENEMY, DUMMY)).toBe(3)
    expect(ctx.getParagon(Team.ALLY, DUMMY)).toBe(0)
  })

  it('trades levels on a cross-team swap', () => {
    const ctx = setup()
    expect(ctx.place(1, DUMMY, Team.ALLY)).toBe(true)
    expect(ctx.place(40, DUMMY_2, Team.ENEMY)).toBe(true)
    ctx.setParagon(Team.ALLY, DUMMY, 2)
    ctx.setParagon(Team.ENEMY, DUMMY_2, 4)

    expect(ctx.swap(1, 40)).toBe(true)

    expect(ctx.getParagon(Team.ENEMY, DUMMY)).toBe(2)
    expect(ctx.getParagon(Team.ALLY, DUMMY_2)).toBe(4)
    expect(ctx.getParagon(Team.ALLY, DUMMY)).toBe(0)
    expect(ctx.getParagon(Team.ENEMY, DUMMY_2)).toBe(0)
  })
})
