<script setup lang="ts">
import ToastMessage from './ToastMessage.vue'
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <ToastMessage
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        @close="remove(toast.id)"
      />
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-sm);
  pointer-events: none;
}

.toast-container > * {
  pointer-events: auto;
}

/* List transitions: enter/leave slide from the right; remaining toasts
   slide up via the move class. The leaving toast goes absolute so the
   stack can close the gap while it animates out. */
.toast-enter-active,
.toast-leave-active,
.toast-move {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-active {
  position: absolute;
}

@media (max-width: 768px) {
  .toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
    align-items: stretch;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(-100%);
  }
}
</style>
