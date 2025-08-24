<script setup lang="ts">
import { computed } from 'vue'

import { useDragDrop } from '../composables/useDragDrop'
import { useGameDataStore } from '../stores/gameData'

const { isDragging, draggedCharacter, draggedImageSrc, dragPreviewPosition } = useDragDrop()
const gameData = useGameDataStore()

// Get background image based on character level
const backgroundImage = computed(() => {
  if (!draggedCharacter.value) return ''
  const level = draggedCharacter.value.level
  const bgImage = gameData.icons[`bg-${level}`]
  return bgImage ? `url(${bgImage})` : ''
})
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
      <div
        class="character-preview"
        :style="{
          backgroundImage: backgroundImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }"
      >
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
</style>
