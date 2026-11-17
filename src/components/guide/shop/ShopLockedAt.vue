<script setup lang="ts">
/* The popup that says which shop level a locked card was locked at: the levels
   up to the shop's that sell the card's product. */

import { useI18nStore } from '@/stores/i18n'

defineProps<{ levels: readonly number[]; level: number }>()

const emit = defineEmits<{ pick: [level: number] }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="shop-popup">
    <p class="shop-popup-title">{{ i18n.t('app.shop-locked-at-title') }}</p>
    <div class="levels">
      <button
        v-for="one in levels"
        :key="one"
        type="button"
        class="shop-pill-button"
        :aria-pressed="one === level"
        @click="emit('pick', one)"
      >
        {{ i18n.t('app.shop-level', { level: one }) }}
      </button>
    </div>
    <p class="note">{{ i18n.t('app.shop-locked-at-note') }}</p>
  </div>
</template>

<style scoped>
.levels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.note {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.6);
}
</style>
