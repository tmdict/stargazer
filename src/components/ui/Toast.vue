<script setup lang="ts">
interface Props {
  message: string
  type?: 'success' | 'error' | 'info'
  show: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'success',
})

const emit = defineEmits<{
  close: []
}>()

const getToastClass = () => {
  return `toast toast-${props.type}`
}

const getIcon = () => {
  switch (props.type) {
    case 'success':
      return '✓'
    case 'error':
      return '✕'
    case 'info':
      return 'ℹ'
    default:
      return '✓'
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="toast" appear>
      <div v-if="show" :class="getToastClass()" @click="emit('close')">
        <div class="toast-content">
          <span class="toast-icon">{{ getIcon() }}</span>
          <span class="toast-message">{{ message }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  min-width: 250px;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-large);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.toast-icon {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.toast-message {
  flex: 1;
}

/* Toast variants */
.toast-success,
.toast-error,
.toast-info {
  background-color: rgba(20, 20, 20, 0.95);
  color: white;
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .toast {
    top: 10px;
    right: 10px;
    left: 10px;
    min-width: auto;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(-100%);
  }
}
</style>
