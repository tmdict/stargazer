<script setup lang="ts">
// Shared tab strip used by all tabbed surfaces (arena, teams, …) so the tabs
// look identical everywhere. Renders only the buttons row; callers wrap it with
// their own content panel. Per-tab visibility (`hidden`, `hideMobile`) is data.
interface Tab {
  key: string
  label: string
  hidden?: boolean
  hideMobile?: boolean
}

defineProps<{
  tabs: Tab[]
}>()

const active = defineModel<string>({ required: true })
</script>

<template>
  <div class="tab-buttons" role="tablist">
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
      </button>
    </template>
  </div>
</template>

<style scoped>
.tab-buttons {
  display: flex;
  justify-content: flex-start;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-large) var(--radius-large) 0 0;
  padding: 0;
  overflow: visible;
  border: 2px solid var(--color-border-primary);
  border-bottom: none;
  min-height: 54px;
  flex-shrink: 0;
}

.tab-btn {
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: var(--spacing-lg) var(--spacing-2xl);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  border-right: 1px solid var(--color-border-primary);
  position: relative;
}

.tab-btn:first-child {
  border-top-left-radius: var(--radius-large);
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn:hover {
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

/* 1280 is the canonical desktop-chrome boundary: max-width rules tune chrome
   at/below it; this min-width rule shrinks the tab font above it. */
@media (min-width: 1280px) {
  .tab-btn {
    font-size: 0.9rem;
  }
}

/* Mirror the narrow-viewport tab styling whenever the containing column is
   narrow, regardless of viewport (a host may declare `container-type:
   inline-size`). Browsers without container-query support fall back to the
   viewport-only @media rules below. */
@container (max-width: 600px) {
  .tab-buttons {
    flex-wrap: wrap;
    gap: 0;
    min-height: auto;
  }

  .tab-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: 0.9rem;
    line-height: 1.2;
    flex: 1 1 auto;
    min-width: 100px;
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    margin-bottom: -1px;
    margin-right: -1px;
  }
}

@media (max-width: 768px) {
  .hide-mobile {
    display: none;
  }

  .tab-buttons {
    flex-wrap: wrap;
    gap: 0;
    /* Drop the 54px desktop floor so the row shrinks to the reduced tab height. */
    min-height: auto;
  }

  .tab-btn {
    /* Trim vertical padding and the inherited 1.6 line-height so the tab bar
       stays compact where space is tight (mobile sheet / narrow column). */
    padding: var(--spacing-sm) var(--spacing-lg);
    font-size: 0.9rem;
    line-height: 1.2;
    flex: 1 1 auto;
    min-width: 100px;
    border-right: 1px solid var(--color-border-primary);
    border-bottom: 1px solid var(--color-border-primary);
    margin-bottom: -1px;
    margin-right: -1px;
  }

  .tab-btn:first-child {
    border-top-left-radius: var(--radius-large);
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
