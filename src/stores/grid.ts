import { computed, reactive, readonly, ref } from 'vue'
import { defineStore } from 'pinia'

import { Grid, type GridTile } from '../lib/grid'
import type { Hex } from '../lib/hex'
import { Layout, POINTY } from '../lib/layout'
import { getMapByKey, type MapConfig } from '../lib/maps'
import { FULL_GRID } from '../lib/types/grid'
import { State } from '../lib/types/state'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export const useGridStore = defineStore('grid', () => {
  // Core grid instance - using reactive for automatic reactivity
  const grid = reactive(new Grid())

  // Reactive hex size state
  const hexSize = ref({ x: 40, y: 40 })

  // Dynamic grid origin that scales with hex size
  const gridOrigin = computed(() => {
    const scale = hexSize.value.x / 40
    return {
      x: 300 * scale,
      y: 300 * scale,
    }
  })

  // Reactive layout that rebuilds when size changes
  const layout = computed(() => new Layout(POINTY, hexSize.value, gridOrigin.value))
  const currentMap = ref('arena1')

  // Computed hexes that updates when grid changes
  const hexes = computed(() => {
    return grid.keys()
  })

  // Core grid operations
  const setState = (hex: Hex, state: State): boolean => {
    return grid.setState(hex, state)
  }

  const getState = (hex: Hex): State => {
    return grid.getTile(hex).state
  }

  // Grid utility functions
  const getHexById = (id: number): Hex => {
    return grid.getHexById(id)
  }

  const getHexPosition = (hexId: number) => {
    try {
      const hex = getHexById(hexId)
      return layout.value.hexToPixel(hex)
    } catch {
      return { x: 0, y: 0 }
    }
  }

  // GridTile-specific methods
  const getTile = (hexOrId: Hex | number): GridTile => {
    if (typeof hexOrId === 'number') {
      return grid.getTileById(hexOrId)
    }
    return grid.getTile(hexOrId)
  }

  const getAllTiles = computed(() => {
    return grid.getAllTiles()
  })

  const switchMap = (mapKey: string): boolean => {
    const mapConfig = getMapByKey(mapKey)
    if (!mapConfig) {
      return false
    }

    // Create new grid with the selected map
    const newGrid = new Grid(FULL_GRID, mapConfig)

    // Copy properties to maintain reactivity
    Object.assign(grid, newGrid)
    currentMap.value = mapKey

    return true
  }

  const getCurrentMapConfig = (): MapConfig | null => {
    return getMapByKey(currentMap.value) ?? null
  }

  // Arrow path utility
  const getArrowPath = (
    startHexId: number,
    endHexId: number,
    characterRadius: number = 30,
    invertCurve: boolean = false,
  ): string => {
    const startHex = grid.getHexById(startHexId)
    const endHex = grid.getHexById(endHexId)
    return layout.value.getArrowPath(startHex, endHex, characterRadius, invertCurve)
  }

  // Get screen position for a hex (includes grid origin offset)
  const getScreenPosition = (hexId: number): { x: number; y: number } => {
    const hex = getHexById(hexId)
    return layout.value.hexToScreen(hex, gridOrigin.value)
  }

  // Breakpoint-based size updater
  const updateBreakpoint = (breakpoint: Breakpoint) => {
    const sizeMap: Record<Breakpoint, { x: number; y: number }> = {
      mobile: { x: 20, y: 20 }, // 50% scale
      tablet: { x: 30, y: 30 }, // 75% scale
      desktop: { x: 40, y: 40 }, // 100% scale
    }

    const newSize = sizeMap[breakpoint]

    // Only update if size actually changed
    if (hexSize.value.x !== newSize.x) {
      hexSize.value = newSize
    }
  }

  // Export scale for components to access
  const getHexScale = () => {
    return hexSize.value.x / 40
  }

  return {
    // Core grid data (readonly)
    grid: readonly(grid),
    layout: readonly(layout),
    hexes,
    gridOrigin: readonly(gridOrigin),
    currentMap: readonly(currentMap),
    hexSize: readonly(hexSize),

    // Core grid operations
    setState,
    getState,
    getHexById,
    getHexPosition,
    getScreenPosition,
    getTile,
    getAllTiles,
    switchMap,
    getCurrentMapConfig,
    getArrowPath,
    updateBreakpoint,
    getHexScale,

    // Internal use by other stores
    _getGrid: () => grid as Grid, // Direct access for character store
  }
})
