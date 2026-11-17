<script setup lang="ts">
/* The close button in a shop popup's top row: on a phone the popup leaves
   little room to tap outside it. */

import IconClose from '@/components/ui/IconClose.vue'
import { useI18nStore } from '@/stores/i18n'

const emit = defineEmits<{ close: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <button
    type="button"
    class="shop-popup-close"
    :aria-label="i18n.t('app.close')"
    @click="emit('close')"
  >
    <IconClose :size="14" />
  </button>
</template>

<style scoped>
.shop-popup-close {
  flex: none;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-left: auto;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.shop-popup-close:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
</style>
