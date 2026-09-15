import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { useMapEditorStore } from '@/stores/mapEditor'
import { ENEMY_A, EVIE } from '../fixtures/characters'

/**
 * Evie outlines the enemy-zone tiles around her mirror cell, so her paint
 * depends on tile states: it must follow a map edit, not wait for the next
 * placement to recompute the skills.
 */
describe('mapEditor.setHexState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const outlinedEnemyTile = (): number => {
    const ctx = useGrids().active!
    expect(ctx.place(5, EVIE, Team.ALLY)).toBe(true)
    const painted = ctx.grid
      .getAllTiles()
      .find(
        (tile) =>
          tile.state === State.AVAILABLE_ENEMY && ctx.getTileColorModifier(tile.hex.getId()),
      )
    expect(painted).toBeDefined()
    return painted!.hex.getId()
  }

  it('refreshes terrain-dependent skill paint after a tile edit', () => {
    const ctx = useGrids().active!
    const hexId = outlinedEnemyTile()

    useMapEditorStore().setHexState(hexId, State.BLOCKED)
    expect(ctx.getTileColorModifier(hexId)).toBeUndefined()

    useMapEditorStore().setHexState(hexId, State.AVAILABLE_ENEMY)
    expect(ctx.getTileColorModifier(hexId)).toBeDefined()
  })

  it('refreshes after the terrain change, not only after the occupant removal', () => {
    const ctx = useGrids().active!
    const hexId = outlinedEnemyTile()
    expect(ctx.place(hexId, ENEMY_A, Team.ENEMY)).toBe(true)

    useMapEditorStore().setHexState(hexId, State.BLOCKED)
    expect(ctx.grid.getTileById(hexId).characterId).toBeUndefined()
    expect(ctx.getTileColorModifier(hexId)).toBeUndefined()
  })
})
