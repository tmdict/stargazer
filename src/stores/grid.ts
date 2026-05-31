import { computed, reactive, readonly, ref } from 'vue'
import { defineStore } from 'pinia'

import { Grid, type GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { Layout, POINTY } from '@/lib/layout'
import { getMapByKey, type MapConfig } from '@/lib/maps'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

// Empirically-tuned multipliers on hexRadius for the team-view crop padding.
// CHARACTER_TOP_PAD_MULTIPLIER covers the perspective-mode character sprite
// stretch (`translateY(-70 * scale)` + `scaleY(~1.82)` on the character, plus
// the parent perspective wrapper's `scaleY(0.55)`) with a small visual buffer
// in the worst case (topmost ally hex at the r=-4 row, hex_center.y ≈ 60).
// If GridCharacters' verticalOffset / scaleY logic changes, this needs
// re-tuning — there isn't a clean closed-form derivation due to the compound
// transforms.
const CHARACTER_TOP_PAD_MULTIPLIER = 2.15
const CHARACTER_BOTTOM_PAD_MULTIPLIER = 0.6

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

  // Team view: when true, only ally tiles are rendered and the SVG is cropped to fit them.
  const teamView = ref(false)

  // Hexes visible under the current view mode. Mirrors `hexes` unless team view is on,
  // in which case it narrows to all ally-state tiles (occupied + available).
  const visibleHexes = computed(() => {
    if (!teamView.value) return hexes.value
    return grid
      .getAllTiles()
      .filter((tile) => tile.state === State.AVAILABLE_ALLY || tile.state === State.OCCUPIED_ALLY)
      .map((tile) => tile.hex)
  })

  // Bounds of the rendered region in unscaled SVG coordinates.
  // Always returns x = 0 and width = full grid width: cropping is vertical-only.
  // Horizontal cropping would clip the ally artifact (anchored at the bottom-left
  // of the full grid) and any other corner-anchored overlays.
  // When team view is off (or no ally tiles exist), height is the full grid box too.
  const viewBoxBounds = computed(() => {
    const scale = hexSize.value.x / 40
    const fullWidth = 600 * scale
    const fullHeight = 600 * scale

    if (!teamView.value || visibleHexes.value.length === 0) {
      return { x: 0, y: 0, width: fullWidth, height: fullHeight }
    }

    const hexRadius = hexSize.value.x
    let minY = Infinity
    let maxY = -Infinity

    for (const hex of visibleHexes.value) {
      for (const c of layout.value.polygonCorners(hex)) {
        if (c.y < minY) minY = c.y
        if (c.y > maxY) maxY = c.y
      }
    }

    // Padding accounts for character sprites — see the multiplier comments
    // at module top for tuning rationale.
    const topPad = hexRadius * CHARACTER_TOP_PAD_MULTIPLIER
    const bottomPad = hexRadius * CHARACTER_BOTTOM_PAD_MULTIPLIER

    // Allow y to go negative when minY < topPad: a negative y becomes positive
    // top-padding inside the clip wrapper (via team-view-shift's `top: -y`),
    // which keeps perspective-mode character sprites from clipping when the
    // topmost ally hex sits near the SVG's y=0 edge.
    const y = minY - topPad
    const height = maxY - minY + topPad + bottomPad

    return { x: 0, y, width: fullWidth, height }
  })

  // Core grid operations
  const setState = (hex: Hex, state: State): void => {
    grid.setState(hex, state)
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
      mobile: { x: 23, y: 23 }, // 57.5% scale
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

    // Team view state (writable; reflects which subset of tiles is rendered)
    teamView,
    visibleHexes,
    viewBoxBounds,

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
