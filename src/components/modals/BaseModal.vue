<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import IconClose from '@/components/ui/IconClose.vue'
import IconLink from '@/components/ui/IconLink.vue'
import { useOverlay } from '@/composables/useOverlay'
import { useScrollLock } from '@/composables/useScrollLock'
import { useI18nStore } from '@/stores/i18n'

import '@/styles/modal.css'
import '@/styles/content.css'

interface Props {
  show: boolean
  maxWidth?: string
  // Hero slug for the permalink button; omit to hide the button (e.g. the
  // about modal, which has no standalone page).
  linkParam?: string
  localeOverride?: 'en' | 'zh'
  // Anchor to viewport top instead of centering. Use when content height can
  // change at runtime so the top edge stays put.
  topAnchor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: '800px',
  topAnchor: false,
})

const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement>()
const i18n = useI18nStore()

// Permalink to the hero's skill page (modal-local locale override wins over global).
const linkHref = computed(() => {
  const locale = props.localeOverride ?? i18n.currentLocale
  return `/${locale}/skill/${props.linkParam}`
})

useOverlay({
  elementRef: modalRef,
  onClose: () => emit('close'),
  isOpen: toRef(props, 'show'),
})

// Lock the page behind so it can't scroll while the modal is open.
useScrollLock(toRef(props, 'show'))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="overlay is-modal" :class="{ 'is-top-anchored': topAnchor }">
        <div ref="modalRef" class="container" :style="{ maxWidth }" @click.stop>
          <div class="buttons">
            <slot name="header-buttons" />
            <a
              v-if="linkParam"
              :href="linkHref"
              class="button"
              :aria-label="i18n.t('app.link')"
              :title="i18n.t('app.link')"
              @click="emit('close')"
            >
              <IconLink :size="16" />
            </a>
            <button class="button" @click="emit('close')" aria-label="Close">
              <IconClose />
            </button>
          </div>

          <div class="content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active :deep(.container),
.modal-leave-active :deep(.container) {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from :deep(.container),
.modal-leave-to :deep(.container) {
  transform: translateY(3px);
}
</style>
