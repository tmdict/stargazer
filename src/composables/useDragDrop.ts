/* Global drag and drop state management for character movement.
 *
 * Coordinates drag operations between character selection and grid placement,
 * providing unified state for both SVG and HTML drag sources. Uses position-based
 * hex detection to handle drops when character portraits block tile events.
 */

import { ref } from 'vue'

import type { CharacterType } from '@/lib/types/character'
import { useGridStore } from '@/stores/grid'

// MIME type for character drag data - prevents conflicts with other drag operations
const CHARACTER_MIME_TYPE = 'application/character'

// Pre-load transparent drag image to avoid timing issues and eliminate browser drag visuals
let transparentDragImage: HTMLImageElement | null = null
if (!import.meta.env.SSR && typeof Image !== 'undefined') {
  transparentDragImage = new Image()
  transparentDragImage.src =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
}

// Global drag state - shared across all components
const isDragging = ref(false)
const draggedCharacter = ref<CharacterType | null>(null)
const draggedImageSrc = ref<string>('')
const dragPreviewPosition = ref({ x: 0, y: 0 })
const dropHandled = ref(false)

// Mouse position tracking for hex detection - enables position-based detection system
const currentMousePosition = ref({ x: 0, y: 0 })
const hoveredHexId = ref<number | null>(null)

export const useDragDrop = () => {
  // Start dragging a character
  const startDrag = (
    event: DragEvent,
    character: CharacterType,
    characterId: number,
    imageUrl?: string,
  ) => {
    if (!event.dataTransfer) return

    isDragging.value = true
    draggedCharacter.value = character
    draggedImageSrc.value = imageUrl || character.name
    dropHandled.value = false // Reset drop handled flag for new drag

    // Set initial position
    updateDragPosition(event.clientX, event.clientY)

    // Set drag data
    event.dataTransfer.setData(
      CHARACTER_MIME_TYPE,
      JSON.stringify({
        character,
        characterId: characterId || character.id,
      }),
    )

    // Set drag effect
    event.dataTransfer.effectAllowed = 'copy'

    // Hide the default drag image using pre-loaded transparent image
    if (transparentDragImage) {
      event.dataTransfer.setDragImage(transparentDragImage, 0, 0)
    }

    // Add visual feedback to original element
    if (event.target instanceof HTMLElement) {
      event.target.style.opacity = '0.5'
    }

    // Add global mouse move listener for drag preview
    document.addEventListener('dragover', handleGlobalDragOver)
    document.addEventListener('drag', handleGlobalDrag)
  }

  // Update drag preview position and current mouse position
  const updateDragPosition = (x: number, y: number) => {
    // Get the current grid scale to adjust preview offset
    const gridStore = useGridStore()
    const scale = gridStore.getHexScale()

    // Scale the offset based on current grid scale (35px is for 100% scale)
    const offset = 35 * scale

    dragPreviewPosition.value = { x: x - offset, y: y - offset } // Offset to center the preview
    currentMousePosition.value = { x, y }
  }

  // Global drag over handler for position tracking
  const handleGlobalDragOver = (event: DragEvent) => {
    if (isDragging.value) {
      updateDragPosition(event.clientX, event.clientY)
      // Don't prevent default here - let the target elements handle it
    }
  }

  // Global drag handler for position tracking
  const handleGlobalDrag = (event: DragEvent) => {
    if (isDragging.value && event.clientX !== 0 && event.clientY !== 0) {
      updateDragPosition(event.clientX, event.clientY)
    }
  }

  // Handle drag end
  const endDrag = (event: DragEvent) => {
    isDragging.value = false
    draggedCharacter.value = null
    draggedImageSrc.value = ''
    hoveredHexId.value = null

    // Reset visual feedback
    if (event.target instanceof HTMLElement) {
      event.target.style.opacity = '1'
    }

    // Remove global event listeners
    document.removeEventListener('dragover', handleGlobalDragOver)
    document.removeEventListener('drag', handleGlobalDrag)

    // Emit event to clear any hover states
    document.dispatchEvent(new CustomEvent('drag-ended'))
  }

  // Handle drag over (required for drop to work)
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  // Handle drop
  const handleDrop = (
    event: DragEvent,
  ): { character: CharacterType; characterId: number } | null => {
    event.preventDefault()

    if (!event.dataTransfer) {
      return null
    }

    try {
      const dragData = event.dataTransfer.getData(CHARACTER_MIME_TYPE)

      if (!dragData) {
        return null
      }

      const { character, characterId } = JSON.parse(dragData)
      return { character, characterId: characterId || character.id }
    } catch (error) {
      console.error('Error parsing drag data:', error)
      return null
    }
  }

  // Check if event contains character data
  const hasCharacterData = (event: DragEvent): boolean => {
    return event.dataTransfer?.types.includes(CHARACTER_MIME_TYPE) || false
  }

  // Set the hovered hex ID (called by position-based hex detection)
  const setHoveredHex = (hexId: number | null) => {
    hoveredHexId.value = hexId
  }

  // Set the drop handled flag
  const setDropHandled = (handled: boolean) => {
    dropHandled.value = handled
  }

  return {
    // State
    isDragging,
    draggedCharacter,
    draggedImageSrc,
    dragPreviewPosition,
    currentMousePosition,
    hoveredHexId,
    dropHandled,

    // Actions
    startDrag,
    endDrag,
    handleDragOver,
    handleDrop,
    hasCharacterData,
    updateDragPosition,
    setHoveredHex,
    setDropHandled,
  }
}
