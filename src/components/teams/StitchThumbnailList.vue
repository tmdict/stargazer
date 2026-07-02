<script setup lang="ts">
import { ref } from 'vue'

import IconClose from '@/components/ui/IconClose.vue'
import type { StitchImage } from '@/composables/useImageStitch'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  images: StitchImage[]
}>()

const emit = defineEmits<{
  remove: [id: string]
  reorder: [from: number, to: number]
}>()

const i18n = useI18nStore()

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

const handleDrop = (to: number) => {
  if (dragIndex.value !== null && dragIndex.value !== to) {
    emit('reorder', dragIndex.value, to)
  }
  dragIndex.value = null
  overIndex.value = null
}
</script>

<template>
  <ul class="thumb-list">
    <li
      v-for="(image, index) in images"
      :key="image.id"
      class="thumb"
      :class="{ dragging: dragIndex === index, 'drop-target': overIndex === index }"
      draggable="true"
      @dragstart="dragIndex = index"
      @dragend="dragIndex = null"
      @dragover.prevent="overIndex = index"
      @dragleave="overIndex === index && (overIndex = null)"
      @drop.prevent="handleDrop(index)"
    >
      <img :src="image.src" :alt="image.name" class="thumb-img" />
      <span class="thumb-index">{{ index + 1 }}</span>
      <button
        class="thumb-remove"
        :title="i18n.t('app.remove-image', { name: image.name })"
        @click="emit('remove', image.id)"
      >
        <IconClose :size="12" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.thumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  list-style: none;
  margin: 0;
  padding: 0;
}

.thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  cursor: grab;
  transition: opacity var(--transition-fast);
}

.thumb.dragging {
  opacity: 0.4;
}

.thumb.drop-target {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-medium);
  display: block;
  pointer-events: none;
}

.thumb-index {
  position: absolute;
  bottom: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1;
  padding: 1px 5px;
  border-radius: var(--radius-small);
}

.thumb-remove {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-danger);
  color: #fff;
  border: none;
  border-radius: var(--radius-round);
  cursor: pointer;
  padding: 0;
  transition: background var(--transition-fast);
}

.thumb-remove:hover {
  background: var(--color-danger-hover);
}
</style>
