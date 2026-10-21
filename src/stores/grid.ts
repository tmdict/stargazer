/* Single-board view over the active grid context.
 *
 * Adapts the active board in useGrids to the grid API the Arena and its
 * components consume. Per-board state (grid, layout, map, crop) reads from the
 * active context; page-wide state (hex size, team view) reads from useGrids.
 */

import { computed } from 'vue'
import { defineStore } from 'pinia'

import type { GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { BASE_HEX_RADIUS } from '@/lib/layout'
import { getMapByKey, type MapConfig } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { useGrids } from './grids'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const BREAKPOINT_SIZES: Record<Breakpoint, { x: number; y: number }> = {
  mobile: { x: 23, y: 23 }, // 57.5% scale
  tablet: { x: 30, y: 30 }, // 75% scale
  desktop: { x: 40, y: 40 }, // 100% scale
}

export const useGridStore = defineStore('grid', () => {
  const grids = useGrids()
  const active = () => grids.active!

  const grid = computed(() => active().grid)
  const layout = computed(() => active().layout)
  const hexes = computed(() => active().grid.keys())
  const currentMap = computed(() => active().currentMap)
  const getAllTiles = computed(() => active().grid.getAllTiles())

  const gridOrigin = computed(() => active().layout.origin)

  const teamView = computed({
    get: () => grids.teamView,
    set: (value: boolean) => {
      grids.teamView = value
    },
  })

  const inverted = computed({
    get: () => grids.inverted,
    set: (value: boolean) => {
      grids.inverted = value
    },
  })

  const setState = (hex: Hex, state: State): void => active().grid.setState(hex, state)

  const resetAllTiles = (state: State = State.DEFAULT): void => {
    for (const hex of active().grid.keys()) active().grid.setState(hex, state)
  }

  const getHexById = (id: number): Hex => active().grid.getHexById(id)

  const getTile = (hexOrId: Hex | number): GridTile =>
    typeof hexOrId === 'number'
      ? active().grid.getTileById(hexOrId)
      : active().grid.getTile(hexOrId)

  // The bare rebuild: the board comes back empty (restores place into it).
  const switchMap = (mapKey: string): boolean => active().switchMap(mapKey)

  // A map picked by the user: the board's units and artifacts come along.
  const moveToMap = (mapKey: string): boolean => grids.moveToMap(active(), mapKey)

  const refreshSkills = (): void => active().refreshSkills()

  const getCurrentMapConfig = (): MapConfig | null => getMapByKey(active().currentMap) ?? null

  let breakpoint: Breakpoint = 'desktop'
  // The hex radius a page fits its single board to on a phone (useBoardFit);
  // null keeps the mobile size.
  let mobileFit: number | null = null

  // No-op while the page pins a fixed hex size (5 v 5). A phone's fit stays
  // between the mobile and tablet sizes.
  const applySize = (): void => {
    if (grids.hexSizeMode !== 'breakpoint') return
    const { mobile, tablet } = BREAKPOINT_SIZES
    const x =
      breakpoint === 'mobile' && mobileFit !== null
        ? Math.min(tablet.x, Math.max(mobile.x, mobileFit))
        : BREAKPOINT_SIZES[breakpoint].x
    if (grids.hexSize.x !== x) grids.hexSize = { x, y: x }
  }

  const updateBreakpoint = (next: Breakpoint): void => {
    breakpoint = next
    applySize()
  }

  const fitMobileBoard = (radius: number | null): void => {
    mobileFit = radius
    applySize()
  }

  const getHexScale = (): number => grids.hexSize.x / BASE_HEX_RADIUS

  return {
    grid,
    layout,
    hexes,
    gridOrigin,
    currentMap,
    teamView,
    inverted,
    setState,
    resetAllTiles,
    getHexById,
    getTile,
    getAllTiles,
    switchMap,
    moveToMap,
    refreshSkills,
    getCurrentMapConfig,
    updateBreakpoint,
    fitMobileBoard,
    getHexScale,
    _getGrid: () => active().grid,
  }
})
