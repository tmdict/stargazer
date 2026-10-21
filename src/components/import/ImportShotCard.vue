<script setup lang="ts">
/* One screenshot in an import's list: a thumbnail that opens the full image
   in a lightbox, its name, the import's own rows about it (the slot), the
   reading's state, and a button that removes it. */

import { ref } from 'vue'

import IconClose from '@/components/ui/IconClose.vue'
import IconExpand from '@/components/ui/IconExpand.vue'
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  name: string
  // Object URL of the file.
  thumb: string
  selected: boolean
  failed: boolean
  status: { text: string; tone: 'plain' | 'warn' | 'error' }
}>()

const emit = defineEmits<{ select: []; remove: [] }>()

const i18n = useI18nStore()

const zoomed = ref(false)
</script>

<template>
  <div
    class="shot"
    :class="{ selected, failed }"
    role="group"
    :aria-label="name"
    @click="emit('select')"
  >
    <button
      type="button"
      class="shot-thumb"
      :aria-label="i18n.t('app.import-view-full')"
      :title="i18n.t('app.import-view-full')"
      @click.stop="zoomed = true"
    >
      <img :src="thumb" alt="" />
      <IconExpand :size="14" class="shot-zoom" />
    </button>
    <button
      type="button"
      class="shot-name"
      :title="name"
      :aria-pressed="selected"
      @click.stop="emit('select')"
    >
      {{ name }}
    </button>
    <slot />
    <div class="shot-status" :class="status.tone">{{ status.text }}</div>
    <button
      type="button"
      class="shot-remove"
      :aria-label="i18n.t('app.import-remove')"
      :title="i18n.t('app.import-remove')"
      @click.stop="emit('remove')"
    >
      <IconClose :size="12" />
    </button>
    <ImageLightbox v-if="zoomed" :src="thumb" :alt="name" @close="zoomed = false" />
  </div>
</template>

<style scoped>
.shot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--import-surface);
  border: 1px solid var(--import-border);
  border-radius: var(--radius-large);
  color: var(--import-text);
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.shot:hover {
  border-color: var(--import-border-strong);
}

.shot.selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.shot.failed {
  border-color: var(--import-bad);
}

.shot-thumb {
  position: relative;
  display: block;
  width: 100%;
  height: 80px;
  padding: 0;
  border: none;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  cursor: zoom-in;
}

.shot-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transition: filter var(--transition-fast);
}

.shot-thumb:hover img,
.shot-thumb:focus-visible img {
  filter: brightness(1.15);
}

.shot-zoom {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 3px;
  border-radius: var(--radius-small);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.shot-thumb:hover .shot-zoom,
.shot-thumb:focus-visible .shot-zoom {
  opacity: 1;
}

@media (pointer: coarse) {
  .shot-zoom {
    opacity: 1;
  }
}

.shot-name {
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.shot-status {
  font-size: 0.75rem;
  color: var(--import-text-dim);
}

.shot-status.warn {
  color: var(--import-warn);
}

.shot-status.error {
  color: var(--import-bad);
}

.shot-remove {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
}

.shot-remove:hover {
  background: var(--color-danger);
}

@media (pointer: coarse) {
  .shot-remove {
    width: 28px;
    height: 28px;
  }
}
</style>
