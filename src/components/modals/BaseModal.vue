<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

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

// Compute the href for the link
const linkHref = computed(() => {
  return props.linkParam === 'about' ? '/about' : `/skill/${props.linkParam}`
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
      <div v-if="show" class="modal-overlay" @click="handleClickOutside">
        <div ref="modalRef" class="modal-container" :style="{ maxWidth }" @click.stop>
          <div class="modal-buttons">
            <a
              :href="linkHref"
              class="modal-link"
              :aria-label="linkParam"
              :title="linkParam"
              @click="emit('close')"
            >
              <IconLink :size="16" />
            </a>
            <button class="modal-close" @click="emit('close')" aria-label="Close">
              <IconClose />
            </button>
          </div>

          <div class="modal-content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  z-index: 9998;
  padding: 40px 20px;
}

.modal-container {
  position: relative;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  width: 100%;
  margin: auto;
  display: flex;
  flex-direction: column;
}

.modal-buttons {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 1;
}

.modal-close,
.modal-link {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover,
.modal-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.modal-link:active {
  transform: scale(0.95);
}

.modal-content {
  padding: 24px 32px 32px 32px;
  color: #fff;
}

/* Typography styles for content */
.modal-content :deep(h1) {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.modal-content :deep(h2) {
  margin: 28px 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.modal-content :deep(p) {
  margin: 12px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.modal-content :deep(ul),
.modal-content :deep(ol) {
  margin: 12px 0;
  padding-left: 20px;
}

.modal-content :deep(li) {
  margin: 6px 0;
  line-height: 1.6;
  color: #fff;
  opacity: 0.9;
}

.modal-content :deep(ul ul) {
  margin-top: 8px;
  margin-bottom: 8px;
}

.modal-content :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.modal-content :deep(a:hover) {
  color: var(--color-danger);
  text-decoration: underline;
}

.modal-content :deep(strong) {
  color: white;
  font-weight: 600;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: translateY(3px);
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 20px;
  }

  .modal-container {
    max-width: 90% !important;
  }

  .modal-content {
    padding: 24px;
    padding-top: 60px;
  }

  .modal-content :deep(h1) {
    font-size: 22px;
  }

  .modal-content :deep(h2) {
    font-size: 17px;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 15px;
  }

  .modal-content {
    padding: 20px;
    padding-top: 56px;
  }

  .modal-content :deep(h1) {
    font-size: 20px;
  }

  .modal-content :deep(h2) {
    font-size: 16px;
  }
}
</style>
