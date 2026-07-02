<script setup lang="ts">
import IconSearch from '@/components/ui/IconSearch.vue'
import { useSearchOverlay, useShortcutLabel } from '@/composables/useSearchOverlay'
import { useI18nStore } from '@/stores/i18n'

// Navigate flavor only: header search must never inherit a roster's select mode.
const { open } = useSearchOverlay()
const i18n = useI18nStore()
const shortcut = useShortcutLabel()
</script>

<template>
  <button
    type="button"
    class="header-search"
    aria-haspopup="dialog"
    :aria-label="i18n.t('app.skill-search-placeholder')"
    :title="i18n.t('app.skill-search-placeholder')"
    @click="open"
  >
    <IconSearch :size="15" class="search-icon" />
    <span class="search-label">{{ i18n.t('app.search-label') }}</span>
    <kbd class="search-kbd">{{ shortcut }}</kbd>
  </button>
</template>

<style scoped>
/* Wide headers only: App.vue swaps this pill for a plain utility-cluster
   icon below 921px (see .nav-search / .menu-search there, which also own
   the nav push). Dressed in the header's own component language (nav-pill
   surface, gold hover); the overlay's teal stays the identity of the opened
   panel. */
.header-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0.2rem;
  padding: 4px 10px 4px 9px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #9ba3af;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.header-search:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #f7d87c;
}

.header-search:focus-visible {
  outline: 2px solid rgba(247, 216, 124, 0.7);
  outline-offset: 2px;
}

.search-icon {
  flex-shrink: 0;
}

.search-kbd {
  min-width: 46px;
  text-align: center;
  font-family: inherit;
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  color: #8a8f98;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 4px;
  padding: 1px 6px;
}

.header-search:hover .search-kbd {
  color: #cbb46a;
}

/* Shortcut chips mean nothing on touch devices. */
@media (hover: none) {
  .search-kbd {
    display: none;
  }
}
</style>
