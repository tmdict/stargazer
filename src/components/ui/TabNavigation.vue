<script setup lang="ts">
import { computed } from 'vue'

import TabBar from './TabBar.vue'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()

defineProps<{
  activeTab: string
}>()

const emit = defineEmits<{
  tabChange: [tab: string]
}>()

// Debug is desktop-only (hidden on mobile to save space; the arena is selectable
// in the Map Editor tab).
const tabs = computed(() => [
  { key: 'characters', label: i18n.t('app.characters') },
  { key: 'seasonal', label: i18n.t('app.seasonal') },
  { key: 'mapEditor', label: i18n.t('app.maps') },
  { key: 'debug', label: i18n.t('app.debug'), hideMobile: true },
])
</script>

<template>
  <div class="tab-container">
    <TabBar :model-value="activeTab" :tabs="tabs" @update:model-value="emit('tabChange', $event)" />

    <!-- Active tab's content; panels manage their own padding/scroll. -->
    <div class="tab-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tab-container {
  /* Negative margin escapes the host panel's 2em card padding (BottomSheet on
     mobile, .section on desktop) so the tab bar spans edge-to-edge. */
  margin: -2em;
  /* Flex-column + flex:1 so the tab content area fills whatever height the host
     gives us (the height-capped column on wide screens, the sheet on mobile)
     while the tab-buttons row stays pinned at its natural size. When the host is
     unconstrained (mobile column stack), height collapses to content and the
     inner overflow:auto becomes a no-op. */
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
}

.tab-content {
  background: var(--color-bg-primary);
  border-radius: 0 0 var(--radius-large) var(--radius-large);
  flex: 1;
  min-height: 0;
  /* Each panel component handles its own internal scrolling (overflow-y: auto
     on the component root). Tab-content stays as a flex shell so the active
     panel can flex-fill on wide screens. */
  display: flex;
  flex-direction: column;
  /* Contain overscroll so collapsing the sheet doesn't pull/refresh the page. */
  overscroll-behavior: contain;
}

@media (max-width: 768px) {
  /* Inside the mobile sheet the host has no padding to escape, so drop the
     negative margin; fill the sheet and let the active panel scroll within it
     (the tab bar stays pinned). */
  .tab-container {
    margin: 0;
    height: auto;
  }
  .tab-content {
    overflow-y: auto;
  }
}
</style>
