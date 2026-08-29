<script setup lang="ts">
/* The Grid Info control: a split chip whose body toggles the master pref and
   whose caret opens the children panel. Three presentations: wide screens get a
   checkbox checklist, narrow (Arena/Teams) gets a chip tray opened by tapping
   the pill (master chip first), and ShareView gets a hover-opening,
   right-aligned checklist. State lives in the shared device pref
   (useGridInfoPrefs); enable cascades run there, so a tap on a nested child
   also lights its parents. A row whose surface is ineffective (master or a
   structural parent off) dims but keeps its remembered checked state. */

import { computed, nextTick, onMounted, onUnmounted, ref, useId } from 'vue'

import {
  GRID_INFO_PARENTS,
  useGridInfoPrefs,
  type GridInfoKey,
} from '@/composables/useGridInfoPrefs'
import { useOverlay } from '@/composables/useOverlay'
import { useI18nStore } from '@/stores/i18n'
import { TABLET_MAX_WIDTH } from '@/utils/breakpoints'
import { clampX } from '@/utils/viewport'

const { share = false } = defineProps<{
  // ShareView presentation: hover-open, right-aligned, checklist everywhere.
  share?: boolean
}>()

const i18n = useI18nStore()
const { prefs, setPref } = useGridInfoPrefs()

interface Row {
  key: GridInfoKey
  label: string
}

const rows: Row[] = [
  { key: 'tileIds', label: 'app.tile-ids' },
  { key: 'coordinates', label: 'app.coordinates' },
  { key: 'hover', label: 'app.details-on-hover' },
  { key: 'targeting', label: 'app.targeting' },
  { key: 'heroCard', label: 'app.hero-card' },
  { key: 'paragon', label: 'app.paragon' },
]

// Indentation and dimming derive from the shared parent map, so the checklist
// cannot drift from the cascade and derivation semantics.
const parentsOf = (key: GridInfoKey): GridInfoKey[] => GRID_INFO_PARENTS[key] ?? []
const isSub = (key: GridInfoKey): boolean => parentsOf(key).length > 0
const ghosted = (key: GridInfoKey): boolean =>
  !prefs.master || parentsOf(key).some((parent) => !prefs[parent])

const toggle = (key: GridInfoKey): void => setPref(key, !prefs[key])

// Narrow layouts swap the checklist trigger for the tray pill. The initial
// read waits for onMounted (the useBreakpoint pattern): the prerendered pages
// carry the wide chip, so a setup-time matchMedia read would hydration-
// mismatch the trigger on narrow viewports. The panel itself is closed at
// mount either way.
const narrowQuery = import.meta.env.SSR
  ? null
  : window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`)
const isNarrow = ref(false)
const onNarrowChange = (): void => {
  isNarrow.value = narrowQuery!.matches
}
narrowQuery?.addEventListener('change', onNarrowChange)
onMounted(() => {
  if (narrowQuery) isNarrow.value = narrowQuery.matches
})
onUnmounted(() => narrowQuery?.removeEventListener('change', onNarrowChange))

const tray = computed(() => !share && isNarrow.value)

const rootRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const panelRef = ref<HTMLElement>()
const panelId = useId()
const open = ref(false)

// The panel centers under the trigger; the shift nudges it back inside the
// viewport near an edge. The share panel right-aligns instead (never shifted).
const panelShift = ref(0)
const clampPanel = (): void => {
  const panel = panelRef.value
  const trigger = triggerRef.value
  if (share || !panel || !trigger) return
  const rect = trigger.getBoundingClientRect()
  const left = rect.left + rect.width / 2 - panel.offsetWidth / 2
  panelShift.value = clampX(left, panel.offsetWidth, 8) - left
}

const openPanel = async (): Promise<void> => {
  cancelClose()
  if (open.value) return
  open.value = true
  window.addEventListener('resize', clampPanel)
  await nextTick()
  clampPanel()
}

const closePanel = (): void => {
  cancelClose()
  if (!open.value) return
  open.value = false
  panelShift.value = 0
  window.removeEventListener('resize', clampPanel)
}

const togglePanel = (): void => {
  if (open.value) closePanel()
  else void openPanel()
}

// ShareView auto-expands on hover (the ArenaDropdown mechanic): mouse pointers
// only, since a touch tap synthesizes mouseenter before click, and the brief
// close delay lets the cursor cross the chip-to-panel gap.
const canHover = !import.meta.env.SSR && window.matchMedia('(hover: hover)').matches
let closeTimer: ReturnType<typeof setTimeout> | null = null
const cancelClose = (): void => {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}
const closeSoon = (): void => {
  cancelClose()
  closeTimer = setTimeout(closePanel, 100)
}
const hoverOpen = (): void => {
  if (share && canHover) void openPanel()
}
const hoverClose = (): void => {
  if (share && canHover) closeSoon()
}

useOverlay({ elementRef: rootRef, isOpen: open, onClose: closePanel })

// Unmount with the panel open (route change, chip hidden by map-editor
// painting) must still drop the resize listener; closePanel also cancels any
// pending hover-close timer.
onUnmounted(closePanel)
</script>

<template>
  <div
    ref="rootRef"
    class="grid-info-toggle"
    :class="{ share }"
    @mouseenter="hoverOpen"
    @mouseleave="hoverClose"
  >
    <!-- Narrow Arena/Teams: one pill, tap opens the tray (master lives inside). -->
    <button
      v-if="tray"
      ref="triggerRef"
      type="button"
      class="pill"
      :class="{ active: prefs.master }"
      :aria-expanded="open"
      :aria-controls="panelId"
      aria-haspopup="true"
      @click="togglePanel"
    >
      {{ i18n.t('app.grid-info') }}<span class="pill-caret">&#9662;</span>
    </button>

    <!-- Wide + ShareView: split chip, body toggles the master, caret opens. -->
    <span v-else ref="triggerRef" class="chip" :class="{ active: prefs.master }">
      <label class="chip-body">
        <input
          type="checkbox"
          class="chip-checkbox"
          :checked="prefs.master"
          @change="toggle('master')"
        />
        <span class="chip-text">{{ i18n.t('app.grid-info') }}</span>
      </label>
      <button
        type="button"
        class="chip-caret"
        :aria-expanded="open"
        :aria-controls="panelId"
        aria-haspopup="true"
        :aria-label="i18n.t('app.grid-info-options')"
        @click="togglePanel"
      >
        &#9662;
      </button>
    </span>

    <div
      v-if="open"
      :id="panelId"
      ref="panelRef"
      class="panel"
      :class="{ tray, ralign: share }"
      :style="{ '--panel-shift': `${panelShift}px` }"
    >
      <template v-if="tray">
        <button
          type="button"
          class="tray-chip"
          :class="{ on: prefs.master }"
          @click="toggle('master')"
        >
          {{ i18n.t('app.grid-info') }}
        </button>
        <span class="tray-divider" />
        <button
          v-for="row in rows"
          :key="row.key"
          type="button"
          class="tray-chip"
          :class="{ on: prefs[row.key], dim: ghosted(row.key) }"
          @click="toggle(row.key)"
        >
          {{ i18n.t(row.label) }}
        </button>
      </template>
      <template v-else>
        <label
          v-for="row in rows"
          :key="row.key"
          class="row"
          :class="{ sub: isSub(row.key), dim: ghosted(row.key) }"
        >
          <input
            type="checkbox"
            class="row-checkbox"
            :checked="prefs[row.key]"
            @change="toggle(row.key)"
          />
          <span>{{ i18n.t(row.label) }}</span>
        </label>
      </template>
    </div>
  </div>
</template>

<style scoped>
.grid-info-toggle {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

/* Split chip, sized like GridControls' .grid-toggle-btn so the row stays even. */
.chip {
  display: inline-flex;
  align-items: stretch;
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  min-height: 36px;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
  transition: all var(--transition-fast);
}

.chip:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.chip-body {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
}

.chip-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

.chip-caret {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--spacing-sm);
  border: none;
  border-left: 1px solid var(--color-border-primary);
  background: none;
  color: inherit;
  font-size: 0.7rem;
  cursor: pointer;
}

.chip-caret:hover {
  background: var(--color-bg-secondary);
}

/* Narrow trigger: matches GridControls' mobile choice chips. */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  padding: 5px 11px;
  min-height: 34px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pill.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.pill-caret {
  font-size: 0.6rem;
}

@media (max-width: 480px) {
  .pill {
    padding: 4px 10px;
    min-height: 30px;
    font-size: 0.74rem;
  }
}

/* ShareView: compact, translucent-on-dark, matching the Edit/Close buttons. */
.grid-info-toggle.share .chip {
  min-height: 32px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
}

.grid-info-toggle.share .chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.grid-info-toggle.share .chip-caret {
  border-left-color: rgba(255, 255, 255, 0.1);
}

.grid-info-toggle.share .chip-caret:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* ShareView panel: the share chrome is dark, so the popover follows it
   instead of the app's light dropdown surface. */
.grid-info-toggle.share .panel {
  background: rgba(20, 20, 20, 0.92);
  backdrop-filter: blur(10px);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.grid-info-toggle.share .row {
  color: rgba(255, 255, 255, 0.65);
}

.grid-info-toggle.share .row:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

/* Children panel, centered under the trigger and clamped to the viewport. */
.panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(calc(-50% + var(--panel-shift, 0px)));
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-medium);
  padding: var(--spacing-sm);
  z-index: var(--z-dropdown);
  min-width: max-content;
}

.panel.ralign {
  left: auto;
  right: 0;
  transform: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-small);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.row:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.row.sub {
  margin-left: 18px;
}

.row.dim {
  opacity: 0.5;
}

.row-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

/* Chip tray (narrow): master first, one divider, then the children. The base
   panel's min-width: max-content would beat max-width and defeat the wrap,
   running the tray off the phone screen. */
.panel.tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: min(320px, calc(100vw - 16px));
}

.tray-chip {
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  padding: 5px 11px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tray-chip.on {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.tray-chip.dim {
  opacity: 0.55;
}

.tray-divider {
  width: 1px;
  align-self: stretch;
  background: var(--color-border-primary);
}
</style>
