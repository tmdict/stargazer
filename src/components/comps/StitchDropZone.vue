<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  add: [files: File[]]
}>()

// Slim "add more" affordance once the list is populated; full panel when empty.
defineProps<{
  compact?: boolean
}>()

const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

const openPicker = () => fileInput.value?.click()

const handleFileInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.length) emit('add', Array.from(input.files))
  input.value = '' // allow re-selecting the same file
}

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false
  const files = event.dataTransfer?.files
  if (files?.length) emit('add', Array.from(files))
}

// Page-level paste: pull any image files off the clipboard.
const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
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
    :class="{ 'drag-over': isDragOver, compact }"
    role="button"
    tabindex="0"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragover.prevent="isDragOver = true"
    @dragleave.prevent="isDragOver = false"
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
    <span class="drop-icon">⬆</span>
    <span class="drop-text"> <strong>Click to upload</strong>, drop images here, or paste </span>
  </div>
</template>

<style scoped>
.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  border: 2px dashed var(--color-primary);
  border-radius: var(--radius-large);
  background: #eef6f5;
  color: var(--color-primary-hover);
  padding: var(--spacing-2xl);
  cursor: pointer;
  text-align: center;
  transition: all var(--transition-fast);
}

.drop-zone:hover,
.drop-zone:focus-visible {
  background: #e3f0ee;
  border-color: var(--color-primary-hover);
  outline: none;
}

.drop-zone.drag-over {
  background: #d8e9e7;
  border-color: var(--color-primary-hover);
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
  font-size: 1.2rem;
}

.drop-zone.compact .drop-icon {
  font-size: 1rem;
}

.drop-text {
  font-size: 0.95rem;
}

.drop-zone.compact .drop-text {
  font-size: 0.85rem;
}
</style>
