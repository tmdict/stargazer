<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

import '@/styles/modal.css'
import { useI18nStore } from '@/stores/i18n'
import IconClose from '../ui/IconClose.vue'
import IconLink from '../ui/IconLink.vue'

interface Props {
  show: boolean
  maxWidth?: string
  linkParam: string
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: '800px',
})

const emit = defineEmits<{
  close: []
}>()

const modalRef = ref<HTMLElement>()
const i18n = useI18nStore()

// Compute the href for the link with locale
const linkHref = computed(() => {
  const locale = i18n.currentLocale
  return props.linkParam === 'about' ? `/${locale}/about` : `/${locale}/skill/${props.linkParam.toLowerCase()}`
})

// Handle escape key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

// Handle click outside
const handleClickOutside = (e: MouseEvent) => {
  if (modalRef.value && !modalRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="overlayModal" @click="handleClickOutside">
        <div ref="modalRef" class="container" :style="{ maxWidth }" @click.stop>
          <div class="buttons">
            <a
              :href="linkHref"
              class="button"
              :aria-label="linkParam"
              :title="linkParam"
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
