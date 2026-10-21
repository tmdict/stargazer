<script setup lang="ts">
/* How many of a side's units an import review has on a tile. */

import { useI18nStore } from '@/stores/i18n'

defineProps<{ placed: number; total: number }>()

const i18n = useI18nStore()
</script>

<template>
  <span
    v-if="total > 0"
    class="place-count"
    :class="{ done: placed === total }"
    :title="placed < total ? i18n.t('app.import-to-place', { count: total - placed }) : undefined"
    >{{ placed }}/{{ total }}</span
  >
</template>

<style scoped>
.place-count {
  flex: none;
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--import-warn);
}

.place-count.done {
  color: var(--import-good);
}
</style>
