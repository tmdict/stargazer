<script setup lang="ts">
import { useDragDrop } from '../composables/useDragDrop'

const { isDragging, draggedCharacter, draggedImageSrc, dragPreviewPosition } = useDragDrop()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isDragging && draggedCharacter && draggedImageSrc"
      class="drag-preview"
      :style="{
        left: `${dragPreviewPosition.x}px`,
        top: `${dragPreviewPosition.y}px`,
      }"
    >
      <div class="character-preview" :class="`level-${draggedCharacter.level}`">
        <img :src="draggedImageSrc" :alt="draggedCharacter.name" class="portrait" />
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
    0 0 0 5px #fff,
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

.level-s {
  background: url('@/assets/images/icons/bg-s.png') center/cover;
}

.level-a {
  background: url('@/assets/images/icons/bg-a.png') center/cover;
}
</style>
