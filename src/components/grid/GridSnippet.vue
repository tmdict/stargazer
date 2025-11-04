<script setup lang="ts">
import { computed } from 'vue'

import { ARENA_1 } from '@/lib/arena/arena1'
import { Grid, type GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { Layout, POINTY } from '@/lib/layout'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'

interface GridStyleConfig {
  numericLabel?: Record<number, number>
  highlight?: number[]
  highlight2?: number[]
  highlight3?: number[]
  character?: Record<string, number>
  imaginaryHexes?: Array<{
    relativeToHex: number
    direction: 1 | 2 | 3 | 4 | 5 | 6 // Clockwise from top-right, starting at 1
    label?: string | number
    fillColor?: string
    strokeColor?: string
    strokeDasharray?: string
  }>
}

interface Props {
  gridStyle: GridStyleConfig
  width?: number
  height?: number
  hexSize?: number
  images?: Record<string, string>
  layout?: 'default' | 'inline'
}

const props = withDefaults(defineProps<Props>(), {
  width: 300,
  height: 300,
  hexSize: 18,
  layout: 'default',
})

// Create grid for snippet
const snippetGrid = computed(() => {
  return new Grid(FULL_GRID, ARENA_1)
})

// Layout for the snippet grid
const snippetLayout = computed(() => {
  return new Layout(
    POINTY,
    { x: props.hexSize, y: props.hexSize },
    { x: props.width / 2, y: props.height / 2 },
  )
})

// Get polygon points for a hex
const getHexPolygon = (hex: Hex): string => {
  const layout = snippetLayout.value
  const corners = layout.polygonCorners(hex)
  return corners.map((p) => `${p.x},${p.y}`).join(' ')
}

// Get hex fill color based on state and highlighting
const getHexFill = (tile: GridTile): string => {
  const hexId = tile.hex.getId()

  // Check for different highlight groups
  if (props.gridStyle.highlight?.includes(hexId)) {
    return 'rgba(255, 215, 0, 0.5)' // Gold highlight
  }
  if (props.gridStyle.highlight2?.includes(hexId)) {
    return 'rgba(100, 200, 255, 0.3)' // Blue highlight
  }
  if (props.gridStyle.highlight3?.includes(hexId)) {
    return 'rgba(150, 100, 255, 0.25)' // Purple highlight
  }

  switch (tile.state) {
    case State.AVAILABLE_ALLY:
      return 'rgba(54, 149, 142, 0.15)'
    case State.AVAILABLE_ENEMY:
      return 'rgba(200, 35, 51, 0.15)'
    case State.BLOCKED:
      return 'rgba(128, 128, 128, 0.3)'
    default:
      return 'rgba(255, 255, 255, 0.05)'
  }
}

// Get text position for hex center
const getHexCenter = (hex: Hex) => {
  const layout = snippetLayout.value
  return layout.hexToPixel(hex)
}

// Get character for a specific hex
const getCharacterForHex = (hexId: number): string | null => {
  if (!props.gridStyle.character) return null

  for (const [character, id] of Object.entries(props.gridStyle.character)) {
    if (id === hexId) {
      return character
    }
  }
  return null
}

// Get character image by name
const getCharacterImage = (characterName: string): string | undefined => {
  return props.images?.[characterName]
}

// Calculate imaginary hex positions
const imaginaryHexes = computed(() => {
  if (!props.gridStyle.imaginaryHexes || !snippetGrid.value) return []

  return props.gridStyle.imaginaryHexes
    .map((config) => {
      const baseHex = snippetGrid.value!.getHexById(config.relativeToHex)
      if (!baseHex) return null

      // Calculate offset based on direction (clockwise from top-right)
      let qOffset = 0,
        rOffset = 0,
        sOffset = 0
      switch (config.direction) {
        case 1: // Top-right
          qOffset = 1
          rOffset = -1
          sOffset = 0
          break
        case 2: // Right
          qOffset = 1
          rOffset = 0
          sOffset = -1
          break
        case 3: // Bottom-right
          qOffset = 0
          rOffset = 1
          sOffset = -1
          break
        case 4: // Bottom-left
          qOffset = -1
          rOffset = 1
          sOffset = 0
          break
        case 5: // Left
          qOffset = -1
          rOffset = 0
          sOffset = 1
          break
        case 6: // Top-left
          qOffset = 0
          rOffset = -1
          sOffset = 1
          break
      }

      const imaginaryHex = new Hex(
        baseHex.q + qOffset,
        baseHex.r + rOffset,
        baseHex.s + sOffset,
        -1,
      )

      const center = snippetLayout.value.hexToPixel(imaginaryHex)
      const corners = snippetLayout.value.polygonCorners(imaginaryHex)
      const points = corners.map((p) => `${p.x},${p.y}`).join(' ')

      return {
        hex: imaginaryHex,
        center,
        points,
        label: config.label,
        fillColor: config.fillColor || 'rgba(255, 255, 255, 0.05)',
        strokeColor: config.strokeColor || 'rgba(255, 255, 255, 0.4)',
        strokeDasharray: config.strokeDasharray || '3,2',
      }
    })
    .filter(Boolean)
})
</script>

<template>
  <div :class="['grid-snippet', `layout-${layout}`]">
    <svg :width :height :viewBox="`0 0 ${width} ${height}`">
      <!-- Define clip paths for each hex -->
      <defs>
        <clipPath
          v-for="tile in snippetGrid.getAllTiles()"
          :key="`clip-${tile.hex.getId()}`"
          :id="`hex-clip-${tile.hex.getId()}`"
        >
          <polygon :points="getHexPolygon(tile.hex)" />
        </clipPath>
      </defs>

      <!-- Hex tiles -->
      <g v-for="tile in snippetGrid.getAllTiles()" :key="tile.hex.getId()">
        <polygon
          :points="getHexPolygon(tile.hex)"
          :fill="getHexFill(tile)"
          stroke="rgba(255, 255, 255, 0.2)"
          stroke-width="1"
        />
        <!-- Character icons (clipped to hex shape) -->
        <image
          v-if="getCharacterForHex(tile.hex.getId())"
          :href="getCharacterImage(getCharacterForHex(tile.hex.getId())!)"
          :x="getHexCenter(tile.hex).x - 20"
          :y="getHexCenter(tile.hex).y - 20"
          width="40"
          height="40"
          preserveAspectRatio="xMidYMid meet"
          :clip-path="`url(#hex-clip-${tile.hex.getId()})`"
        />
        <!-- Numeric labels (on top of character) -->
        <text
          v-if="gridStyle.numericLabel && gridStyle.numericLabel[tile.hex.getId()]"
          :x="getHexCenter(tile.hex).x"
          :y="getHexCenter(tile.hex).y"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="white"
          font-size="14"
          font-weight="bold"
          style="
            text-shadow:
              0 0 3px rgba(0, 0, 0, 0.8),
              0 0 6px rgba(0, 0, 0, 0.5);
          "
        >
          {{ gridStyle.numericLabel[tile.hex.getId()] }}
        </text>
      </g>

      <!-- Imaginary hex tiles -->
      <template v-for="(hexData, index) in imaginaryHexes" :key="`imaginary-${index}`">
        <g v-if="hexData">
          <polygon
            :points="hexData.points"
            :fill="hexData.fillColor"
            :stroke="hexData.strokeColor"
            stroke-width="1"
            :stroke-dasharray="hexData.strokeDasharray"
          />
          <text
            v-if="hexData.label"
            :x="hexData.center.x"
            :y="hexData.center.y"
            text-anchor="middle"
            dominant-baseline="middle"
            fill="white"
            font-size="14"
            font-weight="bold"
            style="
              text-shadow:
                0 0 3px rgba(0, 0, 0, 0.8),
                0 0 6px rgba(0, 0, 0, 0.5);
            "
          >
            {{ hexData.label }}
          </text>
        </g>
      </template>
    </svg>
  </div>
</template>

<style scoped>
.grid-snippet {
  display: flex;
  justify-content: center;
  align-items: center;
}

.grid-snippet.layout-default {
  margin: 20px 0;
  padding: 10px 0;
}

.grid-snippet.layout-inline {
  display: inline-flex;
  margin: 10px;
  padding: 0;
}

.grid-snippet svg {
  display: block;
}
</style>
