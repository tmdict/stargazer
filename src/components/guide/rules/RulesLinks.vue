<script setup lang="ts">
/* A sentence whose parts link to a unit's rules or open a list. */

import type { RulesLink } from './useRules'

defineProps<{ parts: RulesLink[] }>()

const emit = defineEmits<{ go: [unit: string]; open: [list: string] }>()
</script>

<template>
  <p class="reading-meta">
    <template v-for="(part, i) in parts" :key="i"
      ><a v-if="part.go" :href="`#${part.go}`" @click.prevent="emit('go', part.go)">{{
        part.text
      }}</a
      ><button
        v-else-if="part.open"
        type="button"
        class="rules-link"
        @click="emit('open', part.open)"
      >
        {{ part.text }}</button
      ><template v-else>{{ part.text }}</template></template
    >
  </p>
</template>

<style scoped>
.rules-link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 500;
  color: var(--color-accent);
  cursor: pointer;
}

.rules-link:hover {
  text-decoration: underline;
}
</style>
