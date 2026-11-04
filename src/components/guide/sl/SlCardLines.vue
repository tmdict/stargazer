<script setup lang="ts">
/* The body of a card on a generator board: a title, then a list of lines, each
   a bold lead then the rest. Names show in the amber that rings the units a
   card names on the board. */

import type { TextPart } from '@/utils/interpolate'

defineProps<{
  title?: TextPart[]
  lines: { lead: string; parts: TextPart[] }[]
}>()
</script>

<template>
  <div v-if="title" class="sl-card-title">
    <span v-for="(part, i) in title" :key="i" :class="{ 'sl-card-name': part.marked }">{{
      part.text
    }}</span>
  </div>
  <ul class="sl-card-lines">
    <li v-for="(line, index) in lines" :key="index">
      <b>{{ line.lead }}</b
      >{{ ' '
      }}<span v-for="(part, i) in line.parts" :key="i" :class="{ 'sl-card-name': part.marked }">{{
        part.text
      }}</span>
    </li>
  </ul>
</template>

<style scoped>
.sl-card-title {
  margin-bottom: 6px;
  font-weight: 600;
}

.sl-card-lines {
  margin: 0;
  padding-left: 16px;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.sl-card-lines li {
  margin: 0;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
  opacity: 1;
}

.sl-card-lines li + li {
  margin-top: 5px;
}

.sl-card-lines li::marker {
  color: var(--tooltip-muted);
}

.sl-card-lines b {
  font-weight: 600;
}

.sl-card-name {
  color: var(--color-warning);
}
</style>
