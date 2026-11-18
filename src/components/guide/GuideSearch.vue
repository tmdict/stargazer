<script setup lang="ts">
/* The search box of the guide's pages: heroes on the Formation engine rules
   page and the Hero lists page, terms on the Glossary page. */

import IconSearch from '@/components/ui/IconSearch.vue'
import { useI18nStore } from '@/stores/i18n'

const query = defineModel<string>({ required: true })

defineProps<{ label: string }>()

const i18n = useI18nStore()
</script>

<template>
  <label class="guide-search">
    <IconSearch :size="15" />
    <input
      v-model="query"
      type="search"
      autocomplete="off"
      :placeholder="i18n.t(label)"
      :aria-label="i18n.t(label)"
    />
  </label>
</template>

<style scoped>
.guide-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--chip-dark-border-color);
  border-radius: var(--radius-large);
  background: var(--field-dark-background);
  color: var(--reading-muted);
  cursor: text;
}

.guide-search:focus-within {
  border-color: var(--color-accent);
}

.guide-search input {
  flex: 1;
  min-width: 0;
  padding: 7px 0;
  border: 0;
  outline: none;
  background: none;
  color: var(--reading-text);
  font: inherit;
  font-size: max(14px, var(--field-min-font-size));
}
</style>
