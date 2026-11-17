<script setup lang="ts">
/* An Honor Duel item's effect as plain text with its marked values in bold,
   without the details popup's value colour or keyword links. */

import { computed } from 'vue'

import { HIGHLIGHT_RE, splitHighlightToken } from '@/utils/textHighlight'

const { source } = defineProps<{ source: string }>()

const runs = computed(() =>
  source.split(HIGHLIGHT_RE).map((part, index) => ({
    value: index % 2 === 1 ? splitHighlightToken(part).label : part,
    marked: index % 2 === 1,
  })),
)
</script>

<template>
  <div class="duel-effect">
    <template v-for="(run, index) in runs" :key="index"
      ><b v-if="run.marked">{{ run.value }}</b
      ><template v-else>{{ run.value }}</template></template
    >
  </div>
</template>

<style scoped>
.duel-effect {
  line-height: 1.45;
  white-space: pre-line;
}
</style>
