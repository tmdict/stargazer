<script setup lang="ts">
import type { Component } from 'vue'

import IconCheckCircle from '@/components/ui/IconCheckCircle.vue'
import IconCloseCircle from '@/components/ui/IconCloseCircle.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import type { ToastItem } from '@/composables/useToast'

const { type = 'success' } = defineProps<{
  message: string
  type?: ToastItem['type']
}>()

const emit = defineEmits<{
  close: []
}>()

const ICONS: Record<ToastItem['type'], Component> = {
  success: IconCheckCircle,
  error: IconCloseCircle,
  info: IconInfo,
}
</script>

<template>
  <div :class="`toast toast-${type}`" @click="emit('close')">
    <div class="toast-content">
      <component :is="ICONS[type]" :size="18" class="toast-icon" aria-hidden="true" />
      <span class="toast-message">{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
.toast {
  min-width: 250px;
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-float);
  cursor: pointer;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.toast-icon {
  flex: none;
  color: var(--color-accent);
}

.toast-error .toast-icon {
  color: var(--color-danger);
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
