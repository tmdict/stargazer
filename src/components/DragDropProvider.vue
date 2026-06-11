<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import { provideDragDropRegistration, useDragDrop } from '@/composables/useDragDrop'

const { isDragging, hoveredHexId, setHoveredHex, dropHandled } = useDragDrop()

// Registration slots the grid fills in (pointer→hex detection + drop logic)
const { hexDetector, dropHandler } = provideDragDropRegistration()

// Global mouse tracking for hex detection during drag
const handleGlobalMouseMove = (event: MouseEvent) => {
  if (isDragging.value && hexDetector.value) {
    const hexId = hexDetector.value(event.clientX, event.clientY)
    setHoveredHex(hexId)
  }
}

// Track during dragover events for better coverage
const handleGlobalDragOver = (event: DragEvent) => {
  event.preventDefault()

  // Update hex detection during dragover as backup to mousemove
  if (isDragging.value && hexDetector.value) {
    const hexId = hexDetector.value(event.clientX, event.clientY)
    setHoveredHex(hexId)
  }
}

// Global drop handling for characters dropped outside valid hexes
const handleGlobalDrop = (event: DragEvent) => {
  event.preventDefault()

  // Check if drop was already handled by a hex tile
  if (dropHandled.value) {
    return
  }

  // Check if we detected a hex under the mouse using position-based detection
  if (hoveredHexId.value !== null && dropHandler.value) {
    // Let GridManager handle the actual drop logic
    dropHandler.value(event)
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
