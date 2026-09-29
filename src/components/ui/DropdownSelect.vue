<script setup lang="ts">
/* A pick-one dropdown: a trigger naming the current choice and a list of
   options, opening on hover (mouse) or click (useDropdown). Several items may
   show as selected (the Arena quick maps share maps across slots). An optional
   trailing action item (e.g. Manage) sits below the options.

   Variants: `pill` (bordered, on light panels), `tab` (bare text sized like
   the tab strip, list right-aligned), `dark` (translucent, inside the dark
   on-grid popup). The owner can fix the trigger width with
   `--dropdown-trigger-width`. */

import { ref } from 'vue'

import { useDropdown } from '@/composables/useDropdown'
import { usePanelFit } from '@/composables/usePanelFit'

export interface DropdownItem {
  key: string
  label: string
  // Trailing detail, e.g. a count.
  meta?: string | number
  selected: boolean
}

const { variant = 'pill' } = defineProps<{
  label: string
  items: readonly DropdownItem[]
  variant?: 'pill' | 'tab' | 'dark'
  // Accent the trigger, e.g. while a non-default choice is active.
  lit?: boolean
  title?: string
  action?: string
}>()

const emit = defineEmits<{ select: [key: string]; action: [] }>()

const rootRef = ref<HTMLElement>()
const listRef = ref<HTMLElement>()
const { open, hide, toggle, onMouseEnter, onMouseLeave, onTouchStart } = useDropdown({
  rootRef,
  hover: true,
})
const listMaxHeight = usePanelFit(listRef, () => open.value)

const select = (key: string): void => {
  hide()
  emit('select', key)
}

const runAction = (): void => {
  hide()
  emit('action')
}
</script>

<template>
  <div
    ref="rootRef"
    class="dropdown"
    :class="variant"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @touchstart.passive="onTouchStart"
  >
    <button
      type="button"
      class="trigger"
      :class="{ lit }"
      :title
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="trigger-label">{{ label }}</span>
      <span class="caret">▾</span>
    </button>
    <div v-if="open" ref="listRef" class="list" :style="{ maxHeight: listMaxHeight }">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="item"
        :class="{ selected: item.selected }"
        @click="select(item.key)"
      >
        <span class="item-label">{{ item.label }}</span>
        <span v-if="item.meta !== undefined" class="item-meta">{{ item.meta }}</span>
      </button>
      <button v-if="action" type="button" class="item action" @click="runAction">
        {{ action }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  flex-shrink: 0;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: var(--dropdown-trigger-width, auto);
  font: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.trigger-label {
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.caret {
  font-size: 0.6rem;
}

.list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  max-width: 16rem;
  /* Scrolls only past the viewport (usePanelFit). */
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-float);
  z-index: var(--z-dropdown);
}

.item {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-lg);
  width: 100%;
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  font: inherit;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  opacity: 0.7;
}

.item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.item.selected {
  background: var(--color-primary);
  color: #fff;
}

.item.action {
  border-top: 1px solid var(--color-border-light);
  color: var(--color-primary);
}

/* ---- pill ---- */

.pill {
  font-size: 0.85rem;
}

.pill .trigger {
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font-weight: 600;
  padding: 2px 12px;
}

.pill .trigger:hover,
.pill .trigger.lit {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* ---- tab ---- */

.tab {
  font-size: var(--tab-font-size);
  letter-spacing: 0.05em;
}

.tab .trigger {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-weight: 700;
  padding: var(--spacing-xs) var(--spacing-sm);
}

.tab .trigger:hover {
  color: var(--color-primary);
}

.tab .list {
  left: auto;
  right: 0;
}

.tab .item {
  padding: var(--spacing-md) var(--spacing-lg);
}

/* ---- dark: matches the popup's translucent search box ---- */

.dark {
  font-size: 12px;
}

.dark .trigger {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  padding: 4px 8px;
}

.dark .trigger:hover,
.dark .trigger.lit {
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}

.dark .list {
  max-width: 100%;
  background: rgb(32, 32, 32);
  border-color: rgba(255, 255, 255, 0.15);
}

.dark .item {
  color: rgba(255, 255, 255, 0.8);
}

.dark .item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dark .item.selected {
  background: var(--color-primary);
  color: #fff;
}
</style>
