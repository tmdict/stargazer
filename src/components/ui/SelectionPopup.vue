<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useOverlay } from '@/composables/useOverlay'
import { clampX, clampY } from '@/utils/viewport'

// Shared chrome for the selection popups (the on-grid character / artifact
// pickers and the import review's): a fixed-positioned, click-outside-dismissing
// panel. Consumers supply the grid of selectable items via the default slot.
const props = defineProps<{
  position: { x: number; y: number }
  // Layer above an open modal (the match import's review picker); the default
  // layer sits under the modal overlay.
  overModal?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const popupRef = ref<HTMLElement>()

// Keep the panel fully on screen: render at the caller's anchor, then shift it back
// inside the viewport (minus a margin) if it would overflow an edge. The panel
// mounts at full size, so measuring once on open (and on resize) is enough.
const VIEWPORT_MARGIN = 8
const coords = ref({ ...props.position })

const reposition = () => {
  const el = popupRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  coords.value = {
    x: clampX(props.position.x, width, VIEWPORT_MARGIN),
    y: clampY(props.position.y, height, VIEWPORT_MARGIN),
  }
}

useOverlay({
  elementRef: popupRef,
  onClose: () => emit('close'),
  clickOutsideDelay: 100,
})

// Focus lands in the panel unless a child (the character palette's search
// box) already took it, so Escape reaches a consumer's keydown handler on
// the panel before any document-level listener.
onMounted(() => {
  reposition()
  window.addEventListener('resize', reposition)
  const el = popupRef.value
  if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
})
onUnmounted(() => window.removeEventListener('resize', reposition))
watch(() => props.position, reposition)
</script>

<template>
  <div
    ref="popupRef"
    class="selection-popup"
    :class="{ 'over-modal': overModal }"
    :style="{ left: `${coords.x}px`, top: `${coords.y}px` }"
    tabindex="-1"
    @mouseleave="emit('close')"
  >
    <slot />
  </div>
</template>

<style scoped>
.selection-popup {
  position: fixed;
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  z-index: 1000;
  max-width: 320px;
  max-height: 380px;
  outline: none;
  /* A column so a consumer's scrollable grid (min-height: 0) gives way to its
     siblings inside the cap instead of spilling past the panel. */
  display: flex;
  flex-direction: column;
}

.selection-popup.over-modal {
  z-index: var(--z-dropdown);
}

/* Shared slim scrollbar for any scrollable grid the consumer renders inside. */
.selection-popup :deep(::-webkit-scrollbar) {
  width: 4px;
}

.selection-popup :deep(::-webkit-scrollbar-track) {
  background: transparent;
}

.selection-popup :deep(::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.selection-popup :deep(::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.3);
}
</style>
