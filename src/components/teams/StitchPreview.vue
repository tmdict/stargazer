<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import ClearButton from '@/components/ui/ClearButton.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import { useToast } from '@/composables/useToast'
import { useI18nStore } from '@/stores/i18n'
import { copyImageBlob } from '@/utils/clipboard'
import { downloadBlob, timestampedName } from '@/utils/download'

const props = defineProps<{
  canvas: HTMLCanvasElement | null
  dimensions: { width: number; height: number } | null
  oversized: boolean
}>()

const emit = defineEmits<{
  clear: []
}>()

const { success, error } = useToast()
const i18n = useI18nStore()

const previewBox = ref<HTMLElement>()

// Mount the full-resolution canvas; CSS scales it to fit the box. Mount on first
// render (the template ref isn't set yet when a watcher's initial run fires) and
// on every subsequent canvas update.
const mountCanvas = (canvas: HTMLCanvasElement | null) => {
  if (!previewBox.value) return
  if (canvas) {
    canvas.classList.add('preview-canvas')
    previewBox.value.replaceChildren(canvas)
  } else {
    previewBox.value.replaceChildren()
  }
}

onMounted(() => mountCanvas(props.canvas))
watch(() => props.canvas, mountCanvas, { flush: 'post' })

const copy = async () => {
  const canvas = props.canvas
  if (!canvas) return error(i18n.t('app.copy-image-failed'))
  const blob = new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))))
  })
  try {
    await copyImageBlob(blob)
    success(i18n.t('app.copied-clipboard'))
  } catch {
    error(i18n.t('app.copy-image-failed'))
  }
}

const download = () => {
  props.canvas?.toBlob((blob) => {
    if (!blob) return error(i18n.t('app.download-failed'))
    downloadBlob(blob, timestampedName('teams', 'png'))
    success(i18n.t('app.image-downloaded'))
  })
}
</script>

<template>
  <div class="preview">
    <div v-if="oversized" class="preview-warning">
      {{
        i18n.t('app.stitch-oversized', {
          width: dimensions?.width ?? 0,
          height: dimensions?.height ?? 0,
        })
      }}
    </div>
    <div v-else ref="previewBox" class="preview-box">
      <span v-if="dimensions" class="dim-badge"
        >{{ dimensions.width }} × {{ dimensions.height }}</span
      >
    </div>

    <div class="actions">
      <button class="action-btn" :disabled="!canvas" :title="i18n.t('app.copy')" @click="copy">
        <IconCopy :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.copy') }}</span>
      </button>
      <button
        class="action-btn"
        :disabled="!canvas"
        :title="i18n.t('app.download')"
        @click="download"
      >
        <IconDownload :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.download') }}</span>
      </button>
      <ClearButton @click="emit('clear')" />
    </div>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.preview-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-light-gray);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  padding: var(--spacing-md);
  min-height: 160px;
  /* Checkerboard so transparent output is readable. */
  background-image:
    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}

.preview-box :deep(.preview-canvas) {
  max-width: 100%;
  max-height: 60vh;
  height: auto;
  object-fit: contain;
  box-shadow: var(--shadow-small);
}

.dim-badge {
  position: absolute;
  bottom: 6px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.72rem;
  padding: 1px 6px;
  border-radius: var(--radius-small);
}

.preview-warning {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-medium);
  color: var(--color-text-primary);
  padding: var(--spacing-md);
  text-align: center;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--color-primary);
  color: #fff;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-medium);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.action-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-icon {
  flex-shrink: 0;
}

/* Mobile: icon-only round actions, matching the arena grid controls. */
@media (max-width: 768px) {
  .actions {
    gap: 18px;
  }

  .action-btn {
    border-radius: 999px;
    padding: 0;
    width: 40px;
    height: 40px;
    min-height: 0;
    justify-content: center;
  }

  .action-btn .btn-text {
    display: none;
  }

  .action-btn .btn-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .action-btn {
    width: 36px;
    height: 36px;
  }
}
</style>
