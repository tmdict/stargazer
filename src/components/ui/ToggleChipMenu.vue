<script setup lang="ts" generic="K extends string">
/* A master switch with a panel of options: a split chip whose body toggles the
   master and whose caret opens the panel; a mouse also opens it on hover. Three
   presentations: wide screens get a checkbox checklist, narrow ones a chip tray
   opened by tapping a pill (master chip first), and `share` a right-aligned
   checklist on the dark overlay. With no rows the checklist has nothing to open,
   while the tray still holds the master chip. */

import { computed, ref, useId } from 'vue'

import ToggleChip from '@/components/ui/ToggleChip.vue'
import { useDropdown } from '@/composables/useDropdown'
import { useNarrowViewport } from '@/composables/useNarrowViewport'
import { usePanelClamp } from '@/composables/usePanelClamp'

interface ChipMenuRow {
  key: K
  label: string
  checked: boolean
  // Indented under the row above it (checklist only).
  sub?: boolean
  // Has no effect right now, but keeps its remembered tick.
  dim?: boolean
  // A parent with only some of its rows on.
  partial?: boolean
}

interface ChipMenuGroup {
  // Heads the group's column on the checklist and its line in the tray.
  parent?: ChipMenuRow
  rows: readonly ChipMenuRow[]
}

const { groups, share = false } = defineProps<{
  label: string
  optionsLabel: string
  groups: readonly ChipMenuGroup[]
  share?: boolean
}>()

const emit = defineEmits<{ toggle: [key: K] }>()

const master = defineModel<boolean>({ required: true })

const allRows = computed(() => groups.flatMap((group) => group.rows))

const empty = computed(() => allRows.value.length === 0)

const grouped = computed(() => groups.some((group) => group.parent))

const isNarrow = useNarrowViewport()

const tray = computed(() => !share && isNarrow.value)

const rootRef = ref<HTMLElement>()
const panelRef = ref<HTMLElement>()
const panelId = useId()
const {
  open,
  toggle: togglePanel,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
} = useDropdown({ rootRef, hover: true })

const panelOpen = computed(() => open.value && (tray.value || !empty.value))

// The tray hangs from the pill's right edge because a phone zooms the page out
// to fit a panel that starts past the screen's edge, and stays zoomed after the
// nudge. The share panel right-aligns and is never shifted.
const panelShift = usePanelClamp(
  rootRef,
  panelRef,
  () => panelOpen.value && !share,
  () => (tray.value ? 'right' : 'left'),
)
</script>

<template>
  <div
    ref="rootRef"
    class="toggle-chip-menu"
    :class="{ share }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @touchstart.passive="onTouchStart"
  >
    <!-- Narrow: one pill, tap opens the tray (master lives inside). -->
    <button
      v-if="tray"
      type="button"
      class="pill"
      :class="{ active: master }"
      :aria-expanded="panelOpen"
      :aria-controls="panelId"
      aria-haspopup="true"
      @click="togglePanel"
    >
      {{ label }}<span class="pill-caret">&#9662;</span>
    </button>

    <!-- Wide + share: split chip, body toggles the master, caret opens. -->
    <ToggleChip v-else v-model="master" class="chip" :glass="share" :label>
      <template #caret>
        <button
          type="button"
          class="chip-caret"
          :disabled="empty"
          :aria-expanded="panelOpen"
          :aria-controls="panelId"
          aria-haspopup="true"
          :aria-label="optionsLabel"
          @click="togglePanel"
        >
          &#9662;
        </button>
      </template>
    </ToggleChip>

    <div
      v-if="panelOpen"
      :id="panelId"
      ref="panelRef"
      class="panel"
      :class="{ tray, lalign: !tray && !share, ralign: share }"
      :style="{ '--panel-shift': `${panelShift}px` }"
    >
      <template v-if="tray">
        <button type="button" class="tray-chip" :class="{ on: master }" @click="master = !master">
          {{ label }}
        </button>
        <div v-if="grouped" class="tray-groups">
          <template v-for="(group, index) in groups" :key="index">
            <button
              v-if="group.parent"
              type="button"
              class="tray-chip"
              :class="{
                on: group.parent.checked,
                partial: group.parent.partial,
                dim: group.parent.dim,
              }"
              @click="emit('toggle', group.parent.key)"
            >
              {{ group.parent.label }}
            </button>
            <span class="tray-divider" />
            <div class="tray-rows">
              <button
                v-for="row in group.rows"
                :key="row.key"
                type="button"
                class="tray-chip"
                :class="{ on: row.checked, dim: row.dim }"
                @click="emit('toggle', row.key)"
              >
                {{ row.label }}
              </button>
            </div>
          </template>
        </div>
        <template v-else>
          <span class="tray-divider" />
          <button
            v-for="row in allRows"
            :key="row.key"
            type="button"
            class="tray-chip"
            :class="{ on: row.checked, dim: row.dim }"
            @click="emit('toggle', row.key)"
          >
            {{ row.label }}
          </button>
        </template>
      </template>
      <div v-else class="groups">
        <div v-for="(group, index) in groups" :key="index" class="group">
          <label
            v-for="row in group.parent ? [group.parent, ...group.rows] : group.rows"
            :key="row.key"
            class="row"
            :class="{ sub: row.sub, dim: row.dim }"
          >
            <input
              type="checkbox"
              class="row-checkbox"
              :checked="row.checked"
              :indeterminate="row.partial"
              @change="emit('toggle', row.key)"
            />
            <span>{{ row.label }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toggle-chip-menu {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
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

.chip-caret:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.chip-caret:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  padding: var(--toggle-chip-padding-tablet);
  min-height: var(--control-height-tablet);
  font-size: var(--toggle-chip-font-size-tablet);
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
    padding: var(--toggle-chip-padding-mobile);
    min-height: var(--control-height-mobile);
    font-size: var(--toggle-chip-font-size-mobile);
  }
}

.toggle-chip-menu.share .chip {
  min-height: 32px;
  font-size: 0.78rem;
}

.toggle-chip-menu.share .chip-caret {
  border-left-color: rgba(255, 255, 255, 0.1);
}

.toggle-chip-menu.share .chip-caret:hover {
  background: rgba(255, 255, 255, 0.1);
}

.toggle-chip-menu.share .panel {
  background: rgba(20, 20, 20, 0.92);
  backdrop-filter: blur(10px);
  border-color: rgba(255, 255, 255, 0.12);
}

.toggle-chip-menu.share .row {
  color: rgba(255, 255, 255, 0.65);
}

.toggle-chip-menu.share .row:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}

.panel {
  --row-checkbox-size: 0.9rem;
  --row-gap: var(--spacing-sm);
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(calc(-50% + var(--panel-shift, 0px)));
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-float);
  padding: var(--dropdown-list-padding);
  z-index: var(--z-dropdown);
  min-width: max-content;
}

.panel.lalign {
  left: 0;
  transform: translateX(var(--panel-shift, 0px));
}

.panel.ralign {
  left: auto;
  right: 0;
  transform: none;
}

.groups {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--dropdown-row-radius);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.row:hover {
  background: var(--dropdown-row-hover);
  color: var(--color-primary);
}

.row.sub {
  padding-left: calc(var(--spacing-md) + var(--row-checkbox-size) + var(--row-gap));
}

.row.dim {
  opacity: 0.5;
}

.row-checkbox {
  width: var(--row-checkbox-size);
  height: var(--row-checkbox-size);
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

/* The base panel's min-width: max-content would beat max-width and defeat the
   wrap, running the tray off the phone screen. */
.panel.tray {
  left: auto;
  right: 0;
  transform: translateX(var(--panel-shift, 0px));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  width: max-content;
  min-width: 0;
  max-width: min(320px, calc(100vw - 16px));
}

.tray-groups {
  display: grid;
  grid-template-columns: max-content 1px 1fr;
  align-items: start;
  flex-basis: 100%;
  gap: 6px;
}

.tray-rows {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tray-chip {
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  padding: var(--toggle-chip-padding-tablet);
  font-size: var(--toggle-chip-font-size-tablet);
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

.tray-chip.partial {
  background: color-mix(in srgb, var(--color-primary) 25%, var(--color-bg-secondary));
  border-color: var(--color-primary);
  color: var(--color-text-primary);
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
