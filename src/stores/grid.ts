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
  const visibleHexes = computed(() => active().visibleHexes)
  const viewBoxBounds = computed(() => active().viewBoxBounds)
  const getAllTiles = computed(() => active().grid.getAllTiles())

  const gridOrigin = computed(() => {
    const scale = grids.hexSize.x / 40
    return { x: 300 * scale, y: 300 * scale }
  })

  const teamView = computed({
    get: () => grids.teamView,
    set: (value: boolean) => {
      grids.teamView = value
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

  const switchMap = (mapKey: string): boolean => active().switchMap(mapKey)

  const getCurrentMapConfig = (): MapConfig | null => getMapByKey(active().currentMap) ?? null

  const getArrowPath = (
    startHexId: number,
    endHexId: number,
    characterRadius: number = 30,
    invertCurve: boolean = false,
    curveScale: number = 1,
  ): string => {
    const startHex = active().grid.getHexById(startHexId)
    const endHex = active().grid.getHexById(endHexId)
    return active().layout.getArrowPath(startHex, endHex, characterRadius, invertCurve, curveScale)
  }

  // No-op while the page pins a fixed hex size (5 v 5); honored on the Arena.
  const updateBreakpoint = (breakpoint: Breakpoint): void => {
    if (grids.hexSizeMode !== 'breakpoint') return
    const newSize = BREAKPOINT_SIZES[breakpoint]
    if (grids.hexSize.x !== newSize.x) grids.hexSize = newSize
  }

  const getHexScale = (): number => grids.hexSize.x / 40

  return {
    grid,
    layout,
    hexes,
    gridOrigin,
    currentMap,
    teamView,
    visibleHexes,
    viewBoxBounds,
    setState,
    resetAllTiles,
    getHexById,
    getTile,
    getAllTiles,
    switchMap,
    getCurrentMapConfig,
    getArrowPath,
    updateBreakpoint,
    getHexScale,
    _getGrid: () => active().grid,
  }
})
