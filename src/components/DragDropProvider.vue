<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { provideDragDropRegistration, useDragDrop } from '@/composables/useDragDrop'

const { isDragging, hoveredHexId, hoveredGridId, setHoveredHex, dropHandled } = useDragDrop()

// Per-board registration slots (pointer→hex detection + drop logic), filled by
// each GridManager under its own board id.
const { detectors, dropHandlers } = provideDragDropRegistration()

// First board whose detector reports a hex under the pointer wins.
const detectHex = (x: number, y: number) => {
  for (const [gridId, detector] of detectors) {
    const hexId = detector(x, y)
    if (hexId !== null) {
      setHoveredHex(hexId, gridId)
      return
    }
  }
  setHoveredHex(null)
}

// Global mouse tracking for hex detection during drag
const handleGlobalMouseMove = (event: MouseEvent) => {
  if (isDragging.value) detectHex(event.clientX, event.clientY)
}

// Track during dragover events for better coverage
const handleGlobalDragOver = (event: DragEvent) => {
  event.preventDefault()
  // Update hex detection during dragover as backup to mousemove
  if (isDragging.value) detectHex(event.clientX, event.clientY)
}

// Global drop handling for characters dropped outside valid hex tiles
const handleGlobalDrop = (event: DragEvent) => {
  event.preventDefault()

  // Check if drop was already handled by a hex tile
  if (dropHandled.value) {
    return
  }

  // Route to the board under the pointer (position-based detection).
  if (hoveredHexId.value !== null && hoveredGridId.value !== null) {
    dropHandlers.get(hoveredGridId.value)?.(event)
  }
}

onMounted(() => {
  // Add listeners to the document body to catch drops outside the grid
  document.addEventListener('drop', handleGlobalDrop)
  document.addEventListener('dragover', handleGlobalDragOver)
  // Add mouse tracking for hex detection during drag
  document.addEventListener('mousemove', handleGlobalMouseMove)
})

onUnmounted(() => {
  document.removeEventListener('drop', handleGlobalDrop)
  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('mousemove', handleGlobalMouseMove)
})
</script>

<template>
  <div class="drag-drop-provider">
    <slot />
  </div>
</template>

<style scoped>
.drag-drop-provider {
  display: contents;
}
</style>
