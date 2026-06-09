<script setup lang="ts">
import { computed } from 'vue'

import StitchDropZone from './StitchDropZone.vue'
import StitchPreview from './StitchPreview.vue'
import StitchSettings from './StitchSettings.vue'
import StitchThumbnailList from './StitchThumbnailList.vue'
import { useImageStitch } from '@/composables/useImageStitch'
import { useToast } from '@/composables/useToast'

const {
  images,
  settings,
  dimensions,
  exceedsCanvasLimit,
  addFiles,
  removeImage,
  reorder,
  clear,
  render,
} = useImageStitch()

const { error } = useToast()

const hasImages = computed(() => images.value.length > 0)

// Re-stitches whenever the list or settings change (render reads both).
const previewCanvas = computed(() => render())

const handleAdd = async (files: File[]) => {
  const added = await addFiles(files)
  if (added === 0) error('No valid images found')
}
</script>

<template>
  <div class="stitcher ww-card">
    <header class="stitcher-head">
      <h1>Image Stitcher</h1>
      <p>Upload, drop, or paste images to combine them into one.</p>
    </header>

    <StitchSettings
      v-model:direction="settings.direction"
      v-model:gap="settings.gap"
      v-model:background="settings.background"
      v-model:fit="settings.fit"
    />

    <StitchDropZone :compact="hasImages" @add="handleAdd" />

    <StitchThumbnailList v-if="hasImages" :images @remove="removeImage" @reorder="reorder" />

    <StitchPreview
      v-if="hasImages"
      :canvas="previewCanvas"
      :dimensions
      :oversized="exceedsCanvasLimit"
      @clear="clear"
    />
  </div>
</template>

<style scoped>
.stitcher {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  width: 100%;
}

.stitcher-head h1 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--color-text-primary);
}

.stitcher-head p {
  margin: var(--spacing-xs) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.92rem;
}
</style>
