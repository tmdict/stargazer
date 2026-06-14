<script setup lang="ts">
import { computed, useSlots, watchEffect } from 'vue'

import TabList, { type TabItem } from './TabList.vue'

// TabList over a content region. Content comes from named slots keyed by
// `tab.key`; with no tabs the default slot renders, so a page flips
// tabbed/untabbed by adding or removing the tabs array.
const {
  tabs = [],
  fill = false,
  eager = false,
} = defineProps<{
  // Omit or pass [] for the 0-tab case (strip hides, default slot renders).
  tabs?: TabItem[]
  // Content flex-fills the host height and scrolls internally (arena roster,
  // WandWars recommendations). false = content flows at its natural height.
  fill?: boolean
  // Keep every panel mounted (v-show) so state/scroll persist across switches.
  // false = mount only the active panel (v-if).
  eager?: boolean
}>()

const active = defineModel<string>({ default: '' })

const renderTabs = computed(() => tabs.filter((t) => !t.hidden))
const hasTabs = computed(() => renderTabs.value.length > 0)

// Dev-only guard: a typo'd or renamed key silently renders a blank panel.
const slots = useSlots()
if (import.meta.env.DEV) {
  watchEffect(() => {
    for (const tab of renderTabs.value) {
      // A tab may render via its own named slot or a shared default fallback.
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
          <!-- The active tab's own slot, or the default slot as a shared fallback
               (lets several tabs render one parameterized view). -->
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
  /* Escape the host surface's padding so the strip spans edge-to-edge; the
     surface sets --tabview-inset-x/-y to its own padding (0 when it has none).
     The content padding below is re-applied, so the inset is identical on every
     surface regardless of the surface's own padding. */
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
  /* Top/bottom roomy; left/right use the shared --content-padding-x token (also
     on the BottomSheet card) so insets match across surfaces. */
  padding: var(--spacing-2xl) var(--content-padding-x);
}

/* Fill: content fills the remaining height; the active pane and its slotted
   panel manage their own internal scroll (panels differ in how they scroll). */
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
