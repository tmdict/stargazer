<script setup lang="ts">
/* Each team's chance either side of a bar split at Team A's, Team A on the
   left: a game's in its result and its line in the match result, and the
   match's. */

import { slPercent } from '@/components/guide/sl/useSlNames'

const { chance } = defineProps<{
  // Team A's.
  chance: number
  small?: boolean
}>()
</script>

<template>
  <div class="www-chances" :class="{ small }">
    <span class="www-pct a">{{ slPercent(chance) }}</span>
    <span class="www-track" aria-hidden="true"><i :style="{ width: `${chance * 100}%` }" /></span>
    <span class="www-pct b">{{ slPercent(1 - chance) }}</span>
  </div>
</template>

<style scoped>
.www-chances {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.www-pct {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.small .www-pct {
  font-size: 14px;
}

.a {
  color: var(--unit-frame-ally);
}

.b {
  color: var(--unit-frame-enemy);
}

.www-track {
  display: block;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--unit-frame-enemy);
}

.small .www-track {
  height: 4px;
  border-radius: 2px;
}

.www-track > i {
  display: block;
  height: 100%;
  background: var(--unit-frame-ally);
}
</style>
