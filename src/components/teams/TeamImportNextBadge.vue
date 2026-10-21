<script setup lang="ts">
/* The badge on the unit an import review places next, in its side's colour. */

import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ side: Team }>()

const i18n = useI18nStore()
</script>

<template>
  <span class="next-badge" :class="side === Team.ALLY ? 'ally' : 'enemy'">
    {{ i18n.t('app.next') }}
  </span>
</template>

<style scoped>
.next-badge {
  flex: none;
  padding: 1px 6px;
  border-radius: var(--radius-medium);
  font-size: 0.62rem;
  color: #fff;
}

.next-badge.ally {
  background: var(--color-ally);
}

.next-badge.enemy {
  background: var(--color-enemy);
}
</style>
