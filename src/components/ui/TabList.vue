<script lang="ts">
// `key` is the stable id, the v-model value, and the content slot name in TabView.
export interface TabItem {
  key: string
  label: string
  badge?: number | string
  hidden?: boolean
  hideMobile?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

// Single source of tab-strip styling. The strip auto-hides at 0-1 visible tabs
// (the no-tabs page case).
const { tabs } = defineProps<{ tabs: TabItem[] }>()

const active = defineModel<string>({ required: true })

const showStrip = computed(() => tabs.filter((t) => !t.hidden).length > 1)
</script>

<template>
  <div v-if="showStrip" class="tab-buttons" role="tablist">
    <template v-for="tab in tabs" :key="tab.key">
      <button
        v-if="!tab.hidden"
        type="button"
        role="tab"
        :aria-selected="active === tab.key"
        :class="['tab-btn', { active: active === tab.key, 'hide-mobile': tab.hideMobile }]"
        @click="active = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
/* Two looks by width: underline/ink-bar on desktop, the boxed tab bar in the
   mobile bottom sheet (it reads better in the narrow sheet). Shared bits only. */
.tab-buttons {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
}

/* Desktop: flat text on a hairline baseline; active tab gets a teal ink-bar.
   Tabs sit close to the column edge; the baseline spans the full (bled) width. */
@media (min-width: 769px) {
  .tab-buttons {
    gap: var(--spacing-md);
    padding: 0 var(--spacing-sm);
    border-bottom: 1px solid var(--color-border-light);
  }

  .tab-btn {
    /* Transparent bar reserves the active height (no shift on select); -1px
       lands the active bar on the strip's baseline. */
    border-bottom: 2.5px solid transparent;
    margin-bottom: -1px;
    padding: var(--spacing-lg);
    font-size: 0.95rem;
  }

  .tab-btn:hover:not(.active) {
    color: var(--color-text-primary);
  }

  .tab-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }
}

@media (min-width: 1280px) {
  .tab-btn {
    font-size: 0.9rem;
  }
}

/* Mobile / bottom sheet: boxed tab bar — a filled beige strip with the active
   tab highlighted; wraps to a grid when the labels don't fit one row. */
@media (max-width: 768px) {
  .hide-mobile {
    display: none;
  }

  .tab-buttons {
    gap: 0;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-primary);
    border-bottom: none;
    border-radius: var(--radius-large) var(--radius-large) 0 0;
  }

  .tab-btn {
    flex: 1 1 auto;
    min-width: 100px;
    justify-content: center;
    margin: 0 -1px -1px 0;
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: 0.9rem;
    line-height: 1.2;
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    position: relative;
  }

  .tab-btn:first-child {
    border-top-left-radius: var(--radius-large);
  }

  .tab-btn:hover:not(.active) {
    background: var(--color-bg-tertiary);
    color: var(--color-primary);
  }

  .tab-btn.active {
    background: var(--color-bg-primary);
    color: var(--color-primary);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-primary);
  }
}

@media (max-width: 480px) {
  .tab-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.85rem;
    min-width: 80px;
  }
}
</style>
