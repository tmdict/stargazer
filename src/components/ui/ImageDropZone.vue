<script setup lang="ts">
/* Image intake shared by the Image Stitcher and the match import: drop,
   paste, or pick, emitting the image files. Paste is window-level so it works
   without focusing the zone, which is why `pasteActive` exists: the Stitcher
   stays mounted behind the Teams tab, and a paste meant for the import modal
   must not feed it too. */

import { onMounted, onUnmounted, ref } from 'vue'

import IconImage from '@/components/ui/IconImage.vue'
import { useI18nStore } from '@/stores/i18n'
import { imageFilesFromDrop, imageFilesFromInput, imageFilesFromPaste } from '@/utils/imageFile'

const i18n = useI18nStore()

const emit = defineEmits<{
  add: [files: File[]]
}>()

const { pasteActive = true } = defineProps<{
  // Slim "add more" affordance once the list is populated; full panel when empty.
  compact?: boolean
  // Whether window-level pastes belong to this zone right now.
  pasteActive?: boolean
  // Frosted variant for the dark modal surfaces, where the page's cream fill glares.
  dark?: boolean
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

const handlePaste = (event: ClipboardEvent) => {
  if (!pasteActive) return
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
    class="drop-zone"
    :class="{ dragging: isDragging, compact, dark }"
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
  padding: var(--spacing-2xl);
  border: 2px dashed var(--color-border-primary);
  border-radius: var(--radius-large);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

/* All interactive states lift the background; focus and drag also cue the border. */
.drop-zone:hover,
.drop-zone:focus-visible,
.drop-zone.dragging {
  background: var(--color-bg-primary);
}

.drop-zone:focus-visible,
.drop-zone.dragging {
  border-color: var(--color-primary);
  outline: none;
}

.drop-zone.dragging {
  transform: scale(1.01);
}

.drop-zone.compact {
  padding: var(--spacing-md);
  font-size: 0.88rem;
}

.drop-zone.dark {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
}

.drop-zone.dark:hover,
.drop-zone.dark:focus-visible,
.drop-zone.dark.dragging {
  background: rgba(255, 255, 255, 0.1);
}

.drop-zone.dark:focus-visible,
.drop-zone.dark.dragging {
  border-color: var(--color-accent);
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
