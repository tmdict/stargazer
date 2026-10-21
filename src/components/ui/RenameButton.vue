<script setup lang="ts">
/* The pencil button beside a name that starts its inline rename (a roster's,
   the loaded team's). */

import IconEdit from './IconEdit.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
</script>

<template>
  <button
    type="button"
    class="rename-btn"
    :title="i18n.t('app.rename')"
    :aria-label="i18n.t('app.rename')"
  >
    <IconEdit :size="14" />
  </button>
</template>

<style scoped>
.rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border: none;
  background: none;
  border-radius: var(--radius-small);
  color: var(--color-text-secondary);
  opacity: 0.55;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.rename-btn:hover,
.rename-btn:focus-visible {
  opacity: 1;
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}
</style>
