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
