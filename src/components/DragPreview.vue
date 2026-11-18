<script setup lang="ts">
import { computed } from 'vue'

import { useDragDrop } from '@/composables/useDragDrop'
import { useI18nStore } from '@/stores/i18n'
import { characterDisplayName } from '@/utils/nameFormatting'
import { heroBackdrop } from '@/utils/tierBackdrop'

const { isDragging, draggedUnit, draggedImageSrc, draggedBackdrop, dragPreviewPosition } =
  useDragDrop()
const i18n = useI18nStore()

const backdrop = computed(() => {
  if (draggedBackdrop.value) return draggedBackdrop.value
  const level = draggedUnit.value?.hero?.level
  return level === undefined ? undefined : heroBackdrop(level)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isDragging && draggedUnit && draggedImageSrc"
      class="drag-preview"
      :style="{
        left: `${dragPreviewPosition.x}px`,
        top: `${dragPreviewPosition.y}px`,
      }"
    >
      <div class="character-preview" :style="{ background: backdrop }">
        <img
          :src="draggedImageSrc"
          :alt="draggedUnit.hero ? characterDisplayName(i18n.t, draggedUnit.hero) : ''"
          class="portrait"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.drag-preview {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.8;
  transform: scale(0.9);
}

.character-preview {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 0 0 5px var(--hero-icon-ring),
    0 4px 12px rgba(0, 0, 0, 0.3);
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
  color: #333;
}

.character-preview::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff4;
}

.portrait {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border: 2px solid #484848;
  border-radius: 50%;
  z-index: 1;
}
</style>
