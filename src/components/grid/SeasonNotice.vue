<script setup lang="ts">
/* Banner naming the season whose retired content was just stripped from the
 * live boards. Persistent and dismissible, unlike a toast: a strip usually
 * happens during a quiet restore (first visit after a cutover), and an
 * auto-expiring message would vanish before the missing pieces are noticed. */

import IconInfo from '@/components/ui/IconInfo.vue'
import { useSeasonNotice } from '@/composables/useSeasonNotice'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { season, dismiss } = useSeasonNotice()
</script>

<template>
  <div v-if="season !== null" class="season-notice" role="status">
    <IconInfo :size="15" class="season-notice-icon" aria-hidden="true" />
    <span>{{ i18n.t('app.seasonal-removed', { n: season }) }}</span>
    <button type="button" class="season-notice-dismiss" aria-label="Close" @click="dismiss">
      ✕
    </button>
  </div>
</template>

<style scoped>
/* The skill reader's locale-hint banner shape, retinted for the light board
   pages (the accent tokens it uses are tuned for the dark skill surfaces). */
.season-notice {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  border-radius: var(--radius-medium);
  background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-white));
  color: var(--color-text-primary);
  font-size: 12.5px;
}

.season-notice-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.season-notice-dismiss {
  margin-left: auto;
  padding: 0 2px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.season-notice-dismiss:hover {
  color: var(--color-text-primary);
}
</style>
