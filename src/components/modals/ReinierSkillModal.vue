<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

import { ARENA_1 } from '../../lib/arena/arena1'
import { Grid } from '../../lib/grid'
import { Hex } from '../../lib/hex'
import { Layout, POINTY } from '../../lib/layout'
import { FULL_GRID } from '../../lib/types/grid'
import { State } from '../../lib/types/state'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement>()

const gridStyle = {
  numericLabel: {
    4: 1,
    7: 2,
    6: 3,
    12: 4,
    13: 5,
    16: 6,
  } as Record<number, number>,
  highlight: [9],
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
    { x: 150, y: 150 }, // Origin position (centered in taller viewbox)
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
  if (gridStyle.highlight.includes(tile.hex.getId())) {
    return 'rgba(255, 215, 0, 0.4)' // Gold highlight
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
            <h1>Reinier - Dynamic Balance</h1>
            <p>
              Reinier's Dynamic Balance skill connects an adjacent ally's position with an enemy
              hero if they're in a symmetrical position. This unique targeting system affects both
              teams simultaneously.
            </p>

            <h2>How It Works</h2>
            <p>
              Reinier identifies symmetrical hex pairs where one contains an ally and the other
              contains an enemy.
            </p>

            <h2>Tie-Breaking Rules</h2>
            <p>
              When multiple ally-enemy pairs are present, use the following rules to handle
              tie-break:
            </p>
            <ul>
              <li>
                <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left >
                Left > Bottom-right > Right > Top-left > Top-right
              </li>
              <li>
                <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right >
                Top-left > Right > Bottom-right > Left > Bottom-left (This is a 180-degree rotation
                of the ally priority)
              </li>
            </ul>

            <div class="grid-snippet">
              <svg v-if="snippetGrid" width="300" height="300" viewBox="0 0 300 300">
                <!-- Hex tiles -->
                <g v-for="tile in snippetGrid.getAllTiles()" :key="tile.hex.getId()">
                  <polygon
                    :points="getHexPolygon(tile.hex)"
                    :fill="getHexFill(tile)"
                    stroke="rgba(255, 255, 255, 0.2)"
                    stroke-width="1"
                  />
                  <!-- Numeric labels -->
                  <text
                    v-if="gridStyle.numericLabel[tile.hex.getId()]"
                    :x="getHexCenter(tile.hex).x"
                    :y="getHexCenter(tile.hex).y"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="white"
                    font-size="14"
                    font-weight="bold"
                  >
                    {{ gridStyle.numericLabel[tile.hex.getId()] }}
                  </text>
                </g>
              </svg>
            </div>
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

.modal-content ul,
.modal-content ol {
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
