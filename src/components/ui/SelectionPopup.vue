<script setup lang="ts">
import { ref } from 'vue'

import { useOverlay } from '@/composables/useOverlay'

// Shared chrome for the on-grid selection popups (character / artifact pickers):
// a fixed-positioned, click-outside-dismissing panel. Consumers supply the grid
// of selectable items via the default slot.
defineProps<{
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
}>()

const popupRef = ref<HTMLElement>()

useOverlay({
  elementRef: popupRef,
  onClose: () => emit('close'),
  clickOutsideDelay: 100,
})
</script>

<template>
  <div
    ref="popupRef"
    class="selection-popup"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
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
