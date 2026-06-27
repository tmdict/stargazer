<script setup lang="ts">
import IconTrash from './IconTrash.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  emit('click')
}
</script>

<template>
  <button @click="handleClick" class="clear-all-btn" :title="i18n.t('app.clear')">
    <IconTrash :size="14" class="btn-icon" />
    <span class="btn-text">{{ i18n.t('app.clear') }}</span>
  </button>
</template>

<style scoped>
.clear-all-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--color-danger);
  color: white;
  border: 2px solid var(--color-danger);
  padding: var(--spacing-sm) var(--spacing-md);
  margin: 0 5px;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.btn-icon {
  flex-shrink: 0;
}

.clear-all-btn:hover {
  background: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

.clear-all-btn:active {
  transform: scale(0.95);
}

/* Mobile: icon-only round button, matching GridControls' action buttons. The
   desktop side-margin is dropped so spacing comes purely from the row's flex
   gap. Otherwise Clear sits farther from the actions than they do from each
   other. */
@media (max-width: 768px) {
  .clear-all-btn {
    border-radius: 999px;
    padding: 0;
    width: 34px;
    height: 34px;
    margin: 0;
    justify-content: center;
  }
  .clear-all-btn .btn-text {
    display: none;
  }
  .clear-all-btn .btn-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .clear-all-btn {
    width: 30px;
    height: 30px;
  }
  .clear-all-btn .btn-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
