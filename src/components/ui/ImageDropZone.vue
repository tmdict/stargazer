<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import IconImage from '@/components/ui/IconImage.vue'
import { useI18nStore } from '@/stores/i18n'
import { imageFilesFromDrop, imageFilesFromInput, imageFilesFromPaste } from '@/utils/imageFile'

const i18n = useI18nStore()

const emit = defineEmits<{
  add: [files: File[]]
}>()

// Slim "add more" affordance once the list is populated; full panel when empty.
defineProps<{
  compact?: boolean
}>()

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)

const openPicker = () => fileInput.value?.click()

const handleFileInput = (event: Event) => {
  const files = imageFilesFromInput(event)
  if (files.length) emit('add', files)
  ;(event.target as HTMLInputElement).value = '' // allow re-selecting the same file
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = imageFilesFromDrop(event)
  if (files.length) emit('add', files)
}

// Window-level so paste works without focusing the drop zone.
const handlePaste = (event: ClipboardEvent) => {
  const files = imageFilesFromPaste(event)
  if (files.length) {
    event.preventDefault()
    emit('add', files)
  }
}

onMounted(() => window.addEventListener('paste', handlePaste))
onUnmounted(() => window.removeEventListener('paste', handlePaste))
</script>

<template>
  <div
    class="upload-dropzone drop-zone"
    :class="{ dragging: isDragging, compact }"
    role="button"
    tabindex="0"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      class="file-input"
      @change="handleFileInput"
    />
    <IconImage :size="compact ? 18 : 22" class="drop-icon" />
    <span class="drop-text">{{ i18n.t('app.upload-hint') }}</span>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  border-radius: var(--radius-large);
  color: var(--color-text-secondary);
  padding: var(--spacing-2xl);
}

.drop-zone.dragging {
  transform: scale(1.01);
}

.drop-zone.compact {
  padding: var(--spacing-md);
  font-size: 0.88rem;
}

.file-input {
  display: none;
}

.drop-icon {
  flex-shrink: 0;
}

.drop-text {
  font-size: 0.95rem;
}

.drop-zone.compact .drop-text {
  font-size: 0.85rem;
}
</style>
