/* Global drag and drop state management for character movement.
 *
 * Coordinates drag operations between character selection and grid placement,
 * providing unified state for both SVG and HTML drag sources. Uses position-based
 * hex detection to handle drops when character portraits block tile events.
 *
 * State and handlers are module-level singletons: at most one drag exists at a
 * time, and the document listener add/remove pairs must share function identity
 * no matter which component starts or ends the drag.
 */

import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

import type { CharacterType } from '@/lib/types/character'
import { useGridStore } from '@/stores/grid'

// MIME type for character drag data - prevents conflicts with other drag operations
const CHARACTER_MIME_TYPE = 'application/character'

interface CharacterDragPayload {
  character: CharacterType
  characterId: number
}

// Pre-load transparent drag image to avoid timing issues and eliminate browser drag visuals
let transparentDragImage: HTMLImageElement | null = null
if (!import.meta.env.SSR && typeof Image !== 'undefined') {
  transparentDragImage = new Image()
  transparentDragImage.src =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
}

const isDragging = ref(false)
const draggedCharacter = ref<CharacterType | null>(null)
const draggedImageSrc = ref<string>('')
const dragPreviewPosition = ref({ x: 0, y: 0 })
const dropHandled = ref(false)

const hoveredHexId = ref<number | null>(null)
// Hex that received the last drop — consumed (read + cleared) by GridTiles to
// restore the hover highlight once its post-drag grace period ends.
const lastDropHexId = ref<number | null>(null)

const updateDragPosition = (x: number, y: number) => {
  // Get the current grid scale to adjust preview offset
  const gridStore = useGridStore()
  const scale = gridStore.getHexScale()

  // Scale the offset based on current grid scale (35px is for 100% scale)
  const offset = 35 * scale

  dragPreviewPosition.value = { x: x - offset, y: y - offset } // Offset to center the preview
}

const handleGlobalDragOver = (event: DragEvent) => {
  if (isDragging.value) {
    updateDragPosition(event.clientX, event.clientY)
    // Don't prevent default here - let the target elements handle it
  }
}

const handleGlobalDrag = (event: DragEvent) => {
  if (isDragging.value && event.clientX !== 0 && event.clientY !== 0) {
    updateDragPosition(event.clientX, event.clientY)
  }
}

const endDrag = (event: DragEvent) => {
  // The source's own @dragend and the document-level safety net can both fire
  // for the same drag — the second call is a no-op.
  if (!isDragging.value) return

  isDragging.value = false
  draggedCharacter.value = null
  draggedImageSrc.value = ''

  // Hand the drop target to the grid for the post-drag hover highlight
  lastDropHexId.value = hoveredHexId.value
  hoveredHexId.value = null

  // Reset visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '1'
  }

  document.removeEventListener('dragover', handleGlobalDragOver)
  document.removeEventListener('drag', handleGlobalDrag)
  document.removeEventListener('dragend', endDrag)
}

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
  lastDropHexId.value = null

  updateDragPosition(event.clientX, event.clientY)

  event.dataTransfer.setData(
    CHARACTER_MIME_TYPE,
    JSON.stringify({
      character,
      characterId: characterId || character.id,
    }),
  )

  event.dataTransfer.effectAllowed = 'copy'

  // Hide the default drag image using pre-loaded transparent image
  if (transparentDragImage) {
    event.dataTransfer.setDragImage(transparentDragImage, 0, 0)
  }

  // Add visual feedback to original element
  if (event.target instanceof HTMLElement) {
    event.target.style.opacity = '0.5'
  }

  // Add global mouse move listeners for drag preview
  document.addEventListener('dragover', handleGlobalDragOver)
  document.addEventListener('drag', handleGlobalDrag)
  // Safety net: dragend bubbles to document, so even if the source element's
  // own @dragend binding is gone when the drag ends (component re-rendered),
  // the state still resets and the ghost preview can't get stuck.
  document.addEventListener('dragend', endDrag, { once: true })
}

// Handle drag over (required for drop to work)
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

// Handle drop
const handleDrop = (event: DragEvent): CharacterDragPayload | null => {
  event.preventDefault()

  if (!event.dataTransfer) {
    return null
  }

  try {
    const dragData = event.dataTransfer.getData(CHARACTER_MIME_TYPE)

    if (!dragData) {
      return null
    }

    const { character, characterId } = JSON.parse(dragData) as CharacterDragPayload
    return { character, characterId: characterId || character.id }
  } catch (error) {
    console.error('Error parsing drag data:', error)
    return null
  }
}

const hasCharacterData = (event: DragEvent): boolean => {
  return event.dataTransfer?.types.includes(CHARACTER_MIME_TYPE) || false
}

// Set the hovered hex ID (called by position-based hex detection)
const setHoveredHex = (hexId: number | null) => {
  hoveredHexId.value = hexId
}

const setDropHandled = (handled: boolean) => {
  dropHandled.value = handled
}

export const useDragDrop = () => {
  return {
    // State
    isDragging,
    draggedCharacter,
    draggedImageSrc,
    dragPreviewPosition,
    hoveredHexId,
    lastDropHexId,
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

// ---------------------------------------------------------------------------
// Provider registration channel
//
// The grid registers its pointer→hex detector and drop handler with
// DragDropProvider, whose document-level listeners are scoped to its mount —
// its global dragover preventDefault must not outlive the drag UI, so this
// stays a component-provided API rather than module state. Mirrors the
// useGridEvents provide/inject pattern.

export type HexDetector = (x: number, y: number) => number | null
export type DropHandler = (event: DragEvent) => void

export interface DragDropRegistration {
  registerHexDetector: (detector: HexDetector) => void
  registerDropHandler: (handler: DropHandler) => void
}

const DragDropRegistrationKey: InjectionKey<DragDropRegistration> = Symbol('dragDropRegistration')

/**
 * Called by DragDropProvider: provides the registration API to descendants and
 * returns the slots its own document listeners read.
 */
export function provideDragDropRegistration(): {
  hexDetector: Ref<HexDetector | null>
  dropHandler: Ref<DropHandler | null>
} {
  const hexDetector = ref<HexDetector | null>(null)
  const dropHandler = ref<DropHandler | null>(null)

  provide(DragDropRegistrationKey, {
    registerHexDetector: (detector) => {
      hexDetector.value = detector
    },
    registerDropHandler: (handler) => {
      dropHandler.value = handler
    },
  })

  return { hexDetector, dropHandler }
}

export function useDragDropRegistration(): DragDropRegistration {
  const registration = inject(DragDropRegistrationKey)
  if (!registration) {
    throw new Error('useDragDropRegistration must be used within a DragDropProvider')
  }
  return registration
}
