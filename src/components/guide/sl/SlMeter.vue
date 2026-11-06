<script lang="ts">
// The fewest games for each bar.
export const METER_FROM = [1, 5, 10, 30] as const
</script>

<script setup lang="ts">
/* How many games stand behind a team on a map, as four bars. */

import { computed } from 'vue'

const { games } = defineProps<{ games: number }>()

const filled = computed(() => METER_FROM.filter((from) => games >= from).length)
</script>

<template>
  <span class="sl-meter" aria-hidden="true">
    <i v-for="(from, index) in METER_FROM" :key="from" :class="{ on: index < filled }" />
  </span>
</template>

<style scoped>
.sl-meter {
  display: inline-flex;
  gap: 2px;
  flex: none;
}

.sl-meter i {
  width: 6px;
  height: 13px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.16);
}

.sl-meter i.on {
  background: var(--color-primary);
}
</style>
