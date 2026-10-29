<script setup lang="ts">
/* One screenshot in an import's list: a thumbnail that opens the full image
   in a lightbox (`full` when the import draws one of its own, else the file),
   its name, the import's own rows about it (the slot), the reading's state,
   and a button that removes it. Where the import opens one screenshot's
   review at a time (`selected` given), the card selects it. */

import { ref } from 'vue'

import IconCheckCircle from '@/components/ui/IconCheckCircle.vue'
import IconClose from '@/components/ui/IconClose.vue'
import IconExpand from '@/components/ui/IconExpand.vue'
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
import type { ShotStatusView } from '@/components/import/shotStatus'
import { useI18nStore } from '@/stores/i18n'

const { selected } = defineProps<{
  name: string
  // Object URL of the file.
  thumb: string
  full?: string
  selected?: boolean
  failed: boolean
  status: ShotStatusView
}>()

const emit = defineEmits<{ select: []; remove: [] }>()

const i18n = useI18nStore()

const zoomed = ref(false)
</script>

<template>
  <div
    class="shot"
    :class="{ selected, failed, selectable: selected !== undefined }"
    role="group"
    :aria-label="name"
    @click="selected !== undefined && emit('select')"
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
      v-if="selected !== undefined"
      type="button"
      class="shot-name"
      :title="name"
      :aria-pressed="selected"
      @click.stop="emit('select')"
    >
      {{ name }}
    </button>
    <span v-else class="shot-name" :title="name">{{ name }}</span>
    <slot />
    <div class="shot-status" :class="status.tone">
      <IconCheckCircle v-if="status.tone === 'done'" :size="12" />
      {{ status.text }}
      <span v-if="status.tone === 'busy'" class="shot-bar"><i /></span>
    </div>
    <button
      type="button"
      class="shot-remove"
      :aria-label="i18n.t('app.import-remove')"
      :title="i18n.t('app.import-remove')"
      @click.stop="emit('remove')"
    >
      <IconClose :size="12" />
    </button>
    <ImageLightbox v-if="zoomed" :src="full ?? thumb" :alt="name" @close="zoomed = false" />
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
  transition: border-color var(--transition-fast);
}

.shot.selectable {
  cursor: pointer;
}

.shot.selectable:hover {
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
  display: block;
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
}

button.shot-name {
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

.shot-status.busy {
  display: grid;
  gap: 6px;
  color: var(--color-accent);
}

.shot-bar {
  display: block;
  height: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--import-border);
}

.shot-bar > i {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: 2px;
  background: var(--color-accent);
  animation: shot-bar-slide 1.3s ease-in-out infinite;
}

@keyframes shot-bar-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shot-bar {
    display: none;
  }
}

.shot-status.done {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  color: var(--import-good);
}

.shot-status.done svg {
  flex: none;
  margin-top: calc((1lh - 12px) / 2);
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
