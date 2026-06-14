<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

import { useOverlay } from '@/composables/useOverlay'
import { getMapNames } from '@/lib/maps'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

const gridStore = useGridStore()
const i18nStore = useI18nStore()

const arenaMaps = getMapNames().filter((m) => m.key.startsWith('arena'))

const currentArenaName = computed(
  () => arenaMaps.find((m) => m.key === gridStore.currentMap)?.name ?? '',
)

const dropdownRef = ref<HTMLElement>()
const showMenu = ref(false)

// Opens on hover or click. The brief close delay lets the cursor cross the gap
// from the button to the list without the menu snapping shut.
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
  <div ref="dropdownRef" class="arena-dropdown" @mouseenter="open" @mouseleave="closeSoon">
    <button type="button" class="arena-dropdown-btn" :aria-expanded="showMenu" @click="toggle">
      {{ i18nStore.t('app.arena') }} {{ currentArenaName }}
      <span class="arena-dropdown-caret">▾</span>
    </button>
    <div v-if="showMenu" class="arena-dropdown-menu">
      <button
        v-for="m in arenaMaps"
        :key="m.key"
        type="button"
        :class="['arena-dropdown-item', { selected: m.key === gridStore.currentMap }]"
        @click="select(m.key)"
      >
        {{ i18nStore.t('app.arena') }} {{ m.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Desktop-only quick switcher; below 1280px the Map Editor tab is the arena picker. */
.arena-dropdown {
  position: relative;
  display: none;
}

@media (min-width: 1280px) {
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
  text-transform: uppercase;
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
  text-transform: uppercase;
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
