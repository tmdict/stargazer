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
/* Dressed in the header's own component language (nav-pill surface, gold
   hover); the overlay's teal stays the identity of the opened panel. The
   nav-cluster push (margin-left: auto) lives on App.vue's .nav-search class,
   with the rest of the header's layout. */
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

/* Narrow desktop: the full pill pushes the header's natural width past the
   viewport (~836px with en labels), wrapping the utility icons onto a stray
   second row. Collapse to an icon-only pill until there is room. The label
   goes zero-width rather than display: none: its line box is what makes the
   pill the same height as the .nav-text-link neighbors (same font metrics),
   so it keeps setting the height while contributing no width. */
@media (min-width: 769px) and (max-width: 920px) {
  .header-search {
    gap: 0;
  }

  .search-label {
    width: 0;
    overflow: hidden;
  }

  .search-kbd {
    display: none;
  }
}

/* ≤768px the header reflows to logo + icons over a segmented tab strip with
   no room for a pill: collapse to an icon matching the utility cluster. */
@media (max-width: 768px) {
  .header-search {
    margin-bottom: 0;
    padding: 0;
    background: none;
    color: #ddd;
  }

  .header-search:hover {
    background: none;
    color: #f7d87c;
  }

  .search-icon {
    width: 21px;
    height: 21px;
  }

  .search-label,
  .search-kbd {
    display: none;
  }
}
</style>
