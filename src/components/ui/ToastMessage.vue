<script setup lang="ts">
const { type = 'success' } = defineProps<{
  message: string
  type?: 'success' | 'error' | 'info'
}>()

const emit = defineEmits<{
  close: []
}>()

const getIcon = () => {
  switch (type) {
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
  <div :class="`toast toast-${type}`" @click="emit('close')">
    <div class="toast-content">
      <span class="toast-icon">{{ getIcon() }}</span>
      <span class="toast-message">{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
.toast {
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

.toast-success,
.toast-error,
.toast-info {
  background-color: rgba(20, 20, 20, 0.95);
  color: white;
}

@media (max-width: 768px) {
  .toast {
    min-width: auto;
  }
}
</style>
