<script setup lang="ts">
/* The hero search box of the Formation engine rules page and the Hero lists page. */

import IconSearch from '@/components/ui/IconSearch.vue'
import { useI18nStore } from '@/stores/i18n'

const query = defineModel<string>({ required: true })

const i18n = useI18nStore()
</script>

<template>
  <label class="rules-search">
    <IconSearch :size="15" />
    <input
      v-model="query"
      type="search"
      autocomplete="off"
      :placeholder="i18n.t('app.rules-find')"
      :aria-label="i18n.t('app.rules-find')"
    />
  </label>
</template>

<style scoped>
.rules-search {
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

.rules-search:focus-within {
  border-color: var(--color-accent);
}

.rules-search input {
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
