<script setup lang="ts">
/* Full-screen view of one image over whatever opened it: fitted to the
   viewport, a click on the image toggles 1:1 (scrollable), and Escape, the
   close button, or a click on the backdrop dismisses. Layered above the modal
   overlay, since the match import opens it from inside a modal. */

import { onBeforeUnmount, onMounted, ref } from 'vue'

import IconClose from '@/components/ui/IconClose.vue'
import { useScrollLock } from '@/composables/useScrollLock'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  src: string
  alt: string
}>()

const emit = defineEmits<{
  close: []
}>()

const i18n = useI18nStore()
const root = ref<HTMLElement>()
const natural = ref(false)

useScrollLock(ref(true))

// Focus lives here while open so Escape is handled (and stopped) before it
// reaches a parent overlay's document-level listener; it goes back to the
// opener on close.
let opener: Element | null = null
onMounted(() => {
  opener = document.activeElement
  root.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="root"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="alt"
      tabindex="-1"
      @click.stop="emit('close')"
      @keydown.esc.stop.prevent="emit('close')"
    >
      <img
        class="lightbox-image"
        :class="{ natural }"
        :src="src"
        :alt="alt"
        @click.stop="natural = !natural"
      />
      <button
        type="button"
        class="lightbox-close"
        :aria-label="i18n.t('app.close')"
        :title="i18n.t('app.close')"
        @click.stop="emit('close')"
      >
        <IconClose :size="18" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: var(--z-dropdown);
  display: flex;
  overflow: auto;
  padding: 24px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
  outline: none;
  animation: lightbox-in 0.15s ease;
}

/* margin: auto rather than centred alignment so a 1:1 image larger than the
   viewport scrolls to its edges instead of clipping its top and left. */
.lightbox-image {
  display: block;
  margin: auto;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  object-fit: contain;
  border-radius: var(--radius-medium);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  cursor: zoom-in;
}

.lightbox-image.natural {
  max-width: none;
  max-height: none;
  cursor: zoom-out;
}

.lightbox-close {
  position: fixed;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  background: rgba(20, 20, 20, 0.7);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

@keyframes lightbox-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lightbox {
    animation: none;
  }
}
</style>
