<script setup lang="ts">
/* A dropdown: a trigger naming the current choice and a list that opens on
   hover (mouse) or click (useDropdown). The list is the `items`, several of
   which may show as selected (the Arena quick maps share maps across slots),
   plus an optional trailing action item (e.g. Manage). A `default` slot
   replaces it with the owner's own DropdownRows.

   Variants: `pill` (bordered, on light panels), `tab` (bare text sized like
   the tab strip, list right-aligned), `dark` (translucent, inside the dark
   on-grid popup). The owner can fix the trigger width with
   `--dropdown-trigger-width` or give it a floor with
   `--dropdown-trigger-min-width`.

   `floating` moves the list to <body>, for a dropdown inside a scrolling
   panel that would otherwise cut the list off. `clickOnly` and the `open`
   event serve an owner that shows its options some other way and wants the
   list only on request. */

import { computed, ref, watch } from 'vue'

import DropdownRow from './DropdownRow.vue'
import IconClose from './IconClose.vue'
import { useDropdown } from '@/composables/useDropdown'
import { useFloatingPanel } from '@/composables/useFloatingPanel'
import { usePanelFit } from '@/composables/usePanelFit'
import { useI18nStore } from '@/stores/i18n'

export interface DropdownItem {
  key: string
  label: string
  // Trailing detail, e.g. a count.
  meta?: string | number
  selected: boolean
}

const {
  variant = 'pill',
  floating = false,
  items = [],
  lit = false,
  clearable = false,
  clickOnly = false,
} = defineProps<{
  label: string
  items?: readonly DropdownItem[]
  variant?: 'pill' | 'tab' | 'dark'
  large?: boolean
  floating?: boolean
  // Accent the trigger, e.g. while a non-default choice is active.
  lit?: boolean
  // While lit, a clear button stands in for the caret.
  clearable?: boolean
  clickOnly?: boolean
  title?: string
  action?: string
  // The segment's text (a symbol such as +) and its accessible name.
  segment?: string
  segmentLabel?: string
}>()

const emit = defineEmits<{
  select: [key: string]
  action: []
  clear: []
  segment: []
  open: []
}>()

defineSlots<{
  icon?(): unknown
  default?(props: { close: () => void }): unknown
}>()

const i18n = useI18nStore()

const rootRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const listRef = ref<HTMLElement>()
const { open, hide, toggle, onMouseEnter, onMouseLeave, onTouchStart } = useDropdown({
  rootRef,
  panelRef: listRef,
  hover: true,
})
const listMaxHeight = usePanelFit(listRef, () => open.value && !floating)
const floatingStyle = useFloatingPanel(rootRef, listRef, () => open.value && floating)

const clearing = computed(() => clearable && lit)

// Pressing the clear button uncovers the trigger under the pointer; hover
// stays off until the pointer leaves, or the list would reopen at once.
let hoverPaused = false
const hoverTrigger = (): void => {
  if (!clickOnly && !hoverPaused) onMouseEnter()
}
const leave = (): void => {
  hoverPaused = false
  onMouseLeave()
}

const focusTrigger = (): void => triggerRef.value?.focus({ preventScroll: true })

// A closing list takes its rows off the page, and focus on one of them would
// fall to <body>, so the trigger takes it. Focus a click has already moved
// elsewhere stays there.
watch(open, (isOpen) => {
  if (isOpen) emit('open')
  else if (listRef.value?.contains(document.activeElement)) focusTrigger()
})

/* A floating list sits at the end of <body>, outside the Tab order. Tab from
   the dropdown's last control enters it, and Tab or Shift+Tab off either end
   comes back to that control, the order an in-place list has. */
const tabbable = (el: HTMLElement | undefined): HTMLElement[] =>
  el ? [...el.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')] : []

const tabIntoList = (e: KeyboardEvent): void => {
  if (!floating || !open.value || e.shiftKey) return
  const [first] = tabbable(listRef.value)
  if (!first || document.activeElement !== tabbable(rootRef.value).at(-1)) return
  e.preventDefault()
  first.focus()
}

const tabOutOfList = (e: KeyboardEvent): void => {
  if (e.key !== 'Tab') return
  const rows = tabbable(listRef.value)
  if (document.activeElement !== (e.shiftKey ? rows[0] : rows.at(-1))) return
  // Forward, the key's own action then moves on from that control.
  if (e.shiftKey) e.preventDefault()
  tabbable(rootRef.value).at(-1)?.focus()
}

// Only a floating list needs these: in place it is inside the root, where
// leaving it for the trigger would start the close timer.
const listEvents = floating
  ? { mouseenter: onMouseEnter, mouseleave: onMouseLeave, keydown: tabOutOfList }
  : {}

const select = (key: string): void => {
  hide()
  emit('select', key)
}

const runAction = (): void => {
  hide()
  emit('action')
}

const clear = (): void => {
  hoverPaused = true
  hide()
  // The clear button is about to go, with the focus a press gave it.
  focusTrigger()
  emit('clear')
}

const pressSegment = (): void => {
  hide()
  emit('segment')
}
</script>

<template>
  <div
    ref="rootRef"
    class="dropdown"
    :class="[variant, { large, split: segment !== undefined }]"
    @mouseenter="hoverTrigger"
    @mouseleave="leave"
    @touchstart.passive="onTouchStart"
    @keydown.tab="tabIntoList"
  >
    <!-- Hover opens from the trigger as well as the root: coming back from the
         segment, the pointer never left the root. -->
    <button
      ref="triggerRef"
      type="button"
      class="trigger"
      :class="{ lit, clearing }"
      :title
      :aria-expanded="open"
      @click="toggle"
      @mouseenter="hoverTrigger"
    >
      <slot name="icon" />
      <span class="trigger-label">{{ label }}</span>
      <span v-if="!clearing" class="caret">▾</span>
    </button>
    <!-- Beside the trigger, not in it: a button cannot hold another button. -->
    <button
      v-if="clearing"
      type="button"
      class="clear"
      :aria-label="i18n.t('app.clear')"
      @click="clear"
    >
      <IconClose :size="14" />
    </button>
    <!-- Entering the root has already opened the list; the segment is not the
         list's trigger, so it closes it again. -->
    <button
      v-if="segment !== undefined"
      type="button"
      class="segment"
      :title="segmentLabel"
      :aria-label="segmentLabel"
      @mouseenter="hide"
      @click="pressSegment"
    >
      {{ segment }}
    </button>
    <!-- The variant class is repeated on the list: on <body> it has no root
         to inherit the variant's type size from. -->
    <Teleport to="body" :disabled="!floating">
      <div
        v-if="open"
        ref="listRef"
        class="list"
        :class="[variant, { floating, custom: $slots.default }]"
        :style="floating ? floatingStyle : { maxHeight: listMaxHeight }"
        v-on="listEvents"
      >
        <slot :close="hide">
          <DropdownRow
            v-for="item in items"
            :key="item.key"
            class="item"
            :label="item.label"
            :meta="item.meta"
            :selected="item.selected"
            @click="select(item.key)"
          />
          <DropdownRow v-if="action" class="item" :label="action" action @click="runAction" />
        </slot>
      </div>
    </Teleport>
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
  min-width: var(--dropdown-trigger-min-width, auto);
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

.clear {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  color: var(--color-primary);
  translate: 0 -50%;
  cursor: pointer;
}

.clear:hover {
  background: var(--color-border-primary);
}

.list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  max-width: 16rem;
  padding: var(--dropdown-list-padding);
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

/* Placed by useFloatingPanel. The in-place min width would be the viewport's
   on <body>. */
.list.floating {
  position: fixed;
  min-width: 0;
}

.list.custom {
  max-width: calc(100vw - 2 * var(--spacing-sm));
}

/* ---- pill ---- */

.pill {
  font-size: var(--control-font-size);
}

.list.pill {
  --dropdown-row-hover: var(--color-bg-primary);
  background: var(--color-bg-white);
}

.pill .trigger {
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font-weight: var(--control-font-weight);
  padding: 2px 12px;
}

.pill .trigger:hover,
.pill .trigger.lit {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.pill.large .trigger {
  gap: 6px;
  min-height: var(--pill-large-height);
  padding: 0 var(--pill-large-padding);
  border-width: var(--pill-large-border);
}

.pill.large .caret {
  font-size: 0.7rem;
}

.pill .trigger.clearing {
  padding-right: 36px;
}

/* ---- split: a segment on the end of a large pill ---- */

.split {
  --dropdown-segment-width: 34px;
  --dropdown-segment-reach: calc(var(--dropdown-segment-width) + var(--pill-large-border));
}

.segment {
  position: absolute;
  top: var(--pill-large-border);
  right: var(--pill-large-border);
  bottom: var(--pill-large-border);
  display: grid;
  place-items: center;
  width: var(--dropdown-segment-width);
  padding: 0;
  border: none;
  border-left: var(--pill-large-border) solid var(--color-border-primary);
  border-radius: 0 999px 999px 0;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.segment:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.trigger:hover ~ .segment,
.trigger.lit ~ .segment {
  border-left-color: var(--color-primary);
}

.pill.split .trigger {
  padding-right: calc(var(--dropdown-segment-reach) + 8px);
}

.pill.split .trigger.clearing {
  padding-right: calc(var(--dropdown-segment-reach) + 36px);
}

.split .clear {
  right: calc(var(--dropdown-segment-reach) + 8px);
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
  padding-block: var(--spacing-md);
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

.dark .item,
.dark .item.action {
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
