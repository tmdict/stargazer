<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

import { useOverlay } from '@/composables/useOverlay'
import { FIVE_V_FIVE_DEFAULT_MAPS } from '@/lib/maps'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

const gridStore = useGridStore()
const i18nStore = useI18nStore()

// Quick-select slots: Supreme League follows the season's 5v5 map list, so a
// season rollover in maps.ts updates those entries by itself; the GD slots are
// pinned here. One map can back several slots (SL Arena 1 and GD Arena 1 are
// both arena1), so entries key by label and every slot backed by the current
// map highlights.
const quickMaps = computed(() => {
  const arena = i18nStore.t('app.arena')
  return [
    ...FIVE_V_FIVE_DEFAULT_MAPS.map((key, i) => ({ label: `SL ${arena} ${i + 1}`, key })),
    ...['arena1', 'preset-sr3', 'arena5'].map((key, i) => ({ label: `GD ${arena} ${i + 1}`, key })),
  ]
})

// The first matching slot names the trigger; a map picked outside this list
// (the Maps tab offers every preset) falls back to the generic label.
const currentLabel = computed(
  () => quickMaps.value.find((m) => m.key === gridStore.currentMap)?.label,
)

const dropdownRef = ref<HTMLElement>()
const showMenu = ref(false)

// Opens on hover or click. The brief close delay lets the cursor cross the gap
// from the button to the list without the menu snapping shut. Hover-open is for
// mouse pointers only: a touch tap synthesizes mouseenter before click, which
// would open the menu and then immediately toggle it closed.
const canHover = !import.meta.env.SSR && window.matchMedia('(hover: hover)').matches
let closeTimer: ReturnType<typeof setTimeout> | null = null
const cancelClose = () => {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}
const open = () => {
  cancelClose()
  showMenu.value = true
}
const close = () => {
  cancelClose()
  showMenu.value = false
}
const closeSoon = () => {
  closeTimer = setTimeout(close, 100)
}
const toggle = () => (showMenu.value ? close() : open())
const select = (mapKey: string) => {
  gridStore.switchMap(mapKey)
  close()
}

useOverlay({ elementRef: dropdownRef, isOpen: showMenu, onClose: close })

onUnmounted(cancelClose)
</script>

<template>
  <div
    ref="dropdownRef"
    class="arena-dropdown"
    @mouseenter="canHover && open()"
    @mouseleave="canHover && closeSoon()"
  >
    <button type="button" class="arena-dropdown-btn" :aria-expanded="showMenu" @click="toggle">
      {{ currentLabel ?? i18nStore.t('app.arena') }}
      <span class="arena-dropdown-caret">▾</span>
    </button>
    <div v-if="showMenu" class="arena-dropdown-menu">
      <button
        v-for="m in quickMaps"
        :key="m.label"
        type="button"
        :class="['arena-dropdown-item', { selected: m.key === gridStore.currentMap }]"
        @click="select(m.key)"
      >
        {{ m.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Desktop-only quick switcher; below 1320px the Map Editor tab is the arena picker. */
.arena-dropdown {
  position: relative;
  display: none;
}

@media (min-width: 1320px) {
  .arena-dropdown {
    display: block;
  }
}

.arena-dropdown-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--tab-font-size);
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.arena-dropdown-btn:hover {
  color: var(--color-primary);
}

.arena-dropdown-caret {
  font-size: 0.6rem;
}

.arena-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 100%;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-medium);
  overflow: hidden;
  z-index: var(--z-dropdown);
}

.arena-dropdown-item {
  display: block;
  width: 100%;
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--tab-font-size);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.arena-dropdown-item:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.arena-dropdown-item.selected {
  background: var(--color-primary);
  color: #fff;
}
</style>
