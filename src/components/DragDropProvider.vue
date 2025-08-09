<script setup lang="ts">
import { provide, onMounted, onUnmounted, ref, type Ref } from 'vue'

import { useDragDrop } from '../composables/useDragDrop'

// Types for the drag/drop API
export interface DragDropAPI {
  isDragging: Ref<boolean>
  hoveredHexId: Ref<number | null>
  dropHandled: Ref<boolean>
  startDrag: (event: DragEvent, character: any, characterId: number, imageSrc?: string) => void
  endDrag: (event: DragEvent) => void
  handleDrop: (event: DragEvent) => { character: any; characterId: number } | null
  setHoveredHex: (hexId: number | null) => void
  setDropHandled: (handled: boolean) => void
  registerHexDetector: (detector: (x: number, y: number) => number | null) => void
  registerDropHandler: (handler: (event: DragEvent) => void) => void
}

// Use the existing drag/drop composable
const {
  startDrag,
  endDrag,
  isDragging,
  hoveredHexId,
  setHoveredHex,
  handleDrop,
  dropHandled,
  setDropHandled,
} = useDragDrop()

// Hex detector function - will be provided by GridManager
const hexDetector = ref<((x: number, y: number) => number | null) | null>(null)

// Drop handler function - will be provided by GridManager
const dropHandler = ref<((event: DragEvent) => void) | null>(null)

// Register a hex detector function
const registerHexDetector = (detector: (x: number, y: number) => number | null) => {
  hexDetector.value = detector
}

// Register a drop handler function
const registerDropHandler = (handler: (event: DragEvent) => void) => {
  dropHandler.value = handler
}

// Global mouse tracking for hex detection during drag
const handleGlobalMouseMove = (event: MouseEvent) => {
  if (isDragging.value && hexDetector.value) {
    const hexId = hexDetector.value(event.clientX, event.clientY)
    setHoveredHex(hexId)
  }
}

// Track during dragover events for better coverage
const handleGlobalDragOver = (event: DragEvent) => {
  // Prevent default to allow drop
  event.preventDefault()

  // Update hex detection during dragover as backup to mousemove
  if (isDragging.value && hexDetector.value) {
    const hexId = hexDetector.value(event.clientX, event.clientY)
    setHoveredHex(hexId)
  }
}

// Global drop handling for characters dropped outside valid hexes
const handleGlobalDrop = (event: DragEvent) => {
  // Prevent default behavior
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

// Create the API object to provide to children
const dragDropAPI: DragDropAPI = {
  isDragging,
  hoveredHexId,
  dropHandled,
  startDrag,
  endDrag,
  handleDrop,
  setHoveredHex,
  setDropHandled,
  registerHexDetector,
  registerDropHandler,
}

// Provide the API to all child components
provide('dragDrop', dragDropAPI)

// Setup global event handlers
onMounted(() => {
  // Add listeners to the document body to catch drops outside the grid
  document.addEventListener('drop', handleGlobalDrop)
  document.addEventListener('dragover', handleGlobalDragOver)
  // Add mouse tracking for hex detection during drag
  document.addEventListener('mousemove', handleGlobalMouseMove)
})

onUnmounted(() => {
  // Clean up listeners
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
