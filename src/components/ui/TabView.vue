<script setup lang="ts">
import { computed, useSlots, watchEffect } from 'vue'

import TabList, { type TabItem } from './TabList.vue'

// Slots are named by tab.key; the default slot is the fallback for an unnamed
// tab (and the whole body when there are no tabs).
const {
  tabs = [],
  fill = false,
  eager = false,
} = defineProps<{
  tabs?: TabItem[]
  // Content flex-fills the host and scrolls internally; false = flows at natural height.
  fill?: boolean
  // Keep all panels mounted (v-show) to persist state/scroll; false = active only (v-if).
  eager?: boolean
}>()

const active = defineModel<string>({ default: '' })

const renderTabs = computed(() => tabs.filter((t) => !t.hidden))
const hasTabs = computed(() => renderTabs.value.length > 0)

// A renamed/typo'd key would silently render a blank panel; warn in dev.
const slots = useSlots()
if (import.meta.env.DEV) {
  watchEffect(() => {
    for (const tab of renderTabs.value) {
      if (!slots[tab.key] && !slots.default) {
        console.warn(`[TabView] no content slot for tab "${tab.key}"`)
      }
    }
  })
}
</script>

<template>
  <div class="tab-view" :class="{ fill }">
    <TabList v-model="active" :tabs />
    <div class="tab-content" :class="{ fill }">
      <template v-if="hasTabs">
        <template v-if="eager">
          <div
            v-for="tab in renderTabs"
            v-show="active === tab.key"
            :key="tab.key"
            class="tab-pane"
          >
            <slot :name="tab.key" :active />
          </div>
        </template>
        <div v-else class="tab-pane">
          <slot v-if="$slots[active]" :name="active" :active />
          <slot v-else :active />
        </div>
      </template>
      <slot v-else />
    </div>
  </div>
</template>

<style scoped>
.tab-view {
  /* Negative margin = the surface's own padding (via --tabview-inset-*), so the
     strip bleeds to the surface edge; .tab-content re-applies its own inset. */
  margin: calc(-1 * var(--tabview-inset-y, 0px)) calc(-1 * var(--tabview-inset-x, 0px));
  display: flex;
  flex-direction: column;
}

.tab-view.fill {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.tab-content {
  /* Horizontal inset shared with the BottomSheet card (--content-padding-x). */
  padding: var(--spacing-2xl) var(--content-padding-x);
}

/* Just the flex shell — each slotted panel owns its own internal scroll. */
.tab-view.fill .tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
}

.tab-view.fill .tab-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .tab-content {
    padding: var(--spacing-lg) 0;
  }

  .tab-view.fill .tab-content {
    overflow-y: auto;
  }
}

@media (max-width: 480px) {
  .tab-content {
    padding: var(--spacing-sm) 0;
  }
}
</style>
