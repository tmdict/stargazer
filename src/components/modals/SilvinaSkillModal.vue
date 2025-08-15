<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

import { ARENA_1 } from '../../lib/arena/arena1'
import { Grid } from '../../lib/grid'
import { Hex } from '../../lib/hex'
import { Layout, POINTY } from '../../lib/layout'
import { FULL_GRID } from '../../lib/types/grid'
import { State } from '../../lib/types/state'
import { useGameDataStore } from '../../stores/gameData'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement>()
const gameDataStore = useGameDataStore()

const gridStyle = {
  numericLabel: {
    42: 1,
    39: 2,
    33: 3,
    30: 4,
    34: 5,
    40: 6,
    44: 8,
    41: 9,
    36: 10,
    29: 11,
    26: 12,
    23: 13,
    27: 14,
    31: 15,
    38: 16,
    43: 17,
    45: 18,
  } as Record<number, number>,
  highlight: [9, 37],
  highlight2: [30, 33, 34, 39, 40, 42],
  highlight3: [23, 26, 27, 29, 31, 36, 38, 41, 43, 44, 45],
  character: {
    silvina: 9,
  } as Record<string, number>,
}

// Get character image by name
const getCharacterImage = (characterName: string): string | undefined => {
  return gameDataStore.characterImages[characterName]
}

// Get character for a specific hex
const getCharacterForHex = (hexId: number): string | null => {
  for (const [character, id] of Object.entries(gridStyle.character)) {
    if (id === hexId) {
      return character
    }
  }
  return null
}

// Create grid for snippet
const snippetGrid = computed(() => {
  if (!props.show) return null
  return new Grid(FULL_GRID, ARENA_1)
})

// Layout for the snippet grid (smaller size for modal)
const snippetLayout = computed(() => {
  return new Layout(
    POINTY,
    { x: 18, y: 18 }, // Small hex size for modal
    { x: 150, y: 150 }, // Origin position (centered in viewbox)
  )
})

// Get polygon points for a hex
const getHexPolygon = (hex: Hex): string => {
  const layout = snippetLayout.value
  const corners = layout.polygonCorners(hex)
  return corners.map((p) => `${p.x},${p.y}`).join(' ')
}

// Get hex fill color based on state and highlighting
const getHexFill = (tile: any): string => {
  const hexId = tile.hex.getId()

  // Check for different highlight groups
  if (gridStyle.highlight.includes(hexId)) {
    return 'rgba(255, 215, 0, 0.5)' // Gold highlight for center
  }
  if (gridStyle.highlight2.includes(hexId)) {
    return 'rgba(100, 200, 255, 0.3)' // Blue highlight for ring 1
  }
  if (gridStyle.highlight3.includes(hexId)) {
    return 'rgba(150, 100, 255, 0.25)' // Purple highlight for ring 2
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

// Get the imaginary hex position (to the right of hex 45)
const getImaginaryHexData = computed(() => {
  if (!snippetGrid.value) return null

  const hex45 = snippetGrid.value.getHexById(45)
  if (!hex45) return null

  // Create a hex to the right (east direction: +1 q, 0 r, -1 s)
  const imaginaryHex = new Hex(hex45.q + 1, hex45.r, hex45.s - 1, -1)
  const center = snippetLayout.value.hexToPixel(imaginaryHex)
  const corners = snippetLayout.value.polygonCorners(imaginaryHex)
  const points = corners.map((p) => `${p.x},${p.y}`).join(' ')

  return {
    hex: imaginaryHex,
    center,
    points,
  }
})

// Handle escape key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

// Handle click outside
const handleClickOutside = (e: MouseEvent) => {
  if (modalRef.value && !modalRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleClickOutside">
        <div ref="modalRef" class="modal-container" @click.stop>
          <button class="modal-close" @click="emit('close')" aria-label="Close">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div class="modal-content">
            <h1>Silvina - First Strike</h1>
            <p>
              Silvina marks the closest enemy in a symmetrical position, flashes next to them, and
              launches an attack when a battle starts.
            </p>

            <h2>How It Works</h2>
            <p>
              Silvina first checks her symmetrical tile (the mirror position across the grid's
              center). If an enemy is there, they become the target.
            </p>
            <p>
              If the symmetrical tile is empty, Silvina searches for the nearest enemy to that
              position using an expanding clockwise spiral pattern:
            </p>
            <ul>
              <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
              <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
              <li>And so on...</li>
            </ul>
            <div class="grid-snippet">
              <svg v-if="snippetGrid" width="300" height="300" viewBox="0 0 300 300">
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
                    v-if="gridStyle.numericLabel[tile.hex.getId()]"
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

                <!-- Imaginary hex tile (to the right of hex 45) -->
                <g v-if="getImaginaryHexData">
                  <polygon
                    :points="getImaginaryHexData.points"
                    fill="rgba(150, 100, 255, 0.25)"
                    stroke="rgba(255, 255, 255, 0.4)"
                    stroke-width="1"
                    stroke-dasharray="3,2"
                  />
                  <text
                    :x="getImaginaryHexData.center.x"
                    :y="getImaginaryHexData.center.y"
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
                    7
                  </text>
                </g>
              </svg>
            </div>
            <p>
              Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally)
              walks counter-clockwise from bottom-left (180° rotation).
            </p>
            <p>
              (Credit: rkkñ for providing the exact algorithm for Silvina's targeting mechanics)
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  z-index: 9998;
  padding: 40px 20px;
}

.modal-container {
  position: relative;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  max-width: 800px;
  width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 1;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.modal-content {
  padding: 24px 32px 32px 32px;
  color: #fff;
}

.modal-content h1 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.modal-content h2 {
  margin: 28px 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.modal-content p {
  margin: 12px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.modal-content ul {
  margin: 12px 0;
  padding-left: 20px;
}

.modal-content li {
  margin: 6px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.modal-content strong {
  color: white;
  font-weight: 600;
}

/* Grid snippet styles */
.grid-snippet {
  margin: 20px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px 0;
}

.grid-snippet svg {
  display: block;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(3px);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 20px;
  }

  .modal-container {
    max-width: 100%;
  }

  .modal-content {
    padding: 24px;
    padding-top: 60px;
  }

  .modal-content h1 {
    font-size: 22px;
  }

  .modal-content h2 {
    font-size: 17px;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 15px;
  }

  .modal-content {
    padding: 20px;
    padding-top: 56px;
  }

  .modal-content h1 {
    font-size: 20px;
  }

  .modal-content h2 {
    font-size: 16px;
  }
}
</style>
