<script setup lang="ts">
/* A dropdown: a trigger naming the current choice and a list that opens on
   hover (mouse) or click (useDropdown). The list is the `items`, several of
   which may show as selected (the Arena quick maps share maps across slots),
   plus an optional trailing action item (e.g. Manage). A `deletable` item
   carries a delete button, which arms on a first click and emits `delete` on
   the second, and a `renamable` one a pencil that turns its row into a name
   field, which emits `rename`. A `default` slot replaces the list with the
   owner's own DropdownRows.

   Variants: `pill` (bordered, on light panels), `tab` (bare text sized like
   the tab strip, list right-aligned), `dark` (translucent, inside the dark
   on-grid popup), `icon` (the `icon` slot alone on dark chrome, `label` its
   accessible name, list dark and right-aligned), `nav` (the owner's own
   `trigger` slot on dark chrome, such as a top bar link, list dark). The
   owner can fix the trigger width with `--dropdown-trigger-width` or give it
   a floor with `--dropdown-trigger-min-width`.

   `floating` moves the list to <body>, for a dropdown inside a scrolling
   panel that would otherwise cut the list off. `clickOnly` and the `open`
   event serve an owner that shows its options some other way and wants the
   list only on request. */

import { computed, onUnmounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import DropdownRow from './DropdownRow.vue'
import IconClose from './IconClose.vue'
import IconEdit from './IconEdit.vue'
import IconMinus from './IconMinus.vue'
import IconPlus from './IconPlus.vue'
import IconTrashSmall from './IconTrashSmall.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { opensElsewhere, useDropdown } from '@/composables/useDropdown'
import { useFloatingPanel } from '@/composables/useFloatingPanel'
import { useInlineRename } from '@/composables/useInlineRename'
import { usePanelFit } from '@/composables/usePanelFit'
import { MAX_NAME_LENGTH } from '@/lib/names'
import { useI18nStore } from '@/stores/i18n'
import { isComposing } from '@/utils/keyboard'

export interface DropdownItem {
  key: string
  label: string
  // Trailing detail, e.g. a count.
  meta?: string | number
  metaColor?: string
  selected: boolean
  // Makes the row a link; `select` still fires when it is followed here.
  to?: RouteLocationRaw
  href?: string
  deletable?: boolean
  renamable?: boolean
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
  variant?: 'pill' | 'tab' | 'dark' | 'icon' | 'nav'
  large?: boolean
  floating?: boolean
  // Accent the trigger, e.g. while a non-default choice is active.
  lit?: boolean
  // While lit, a clear button stands in for the caret.
  clearable?: boolean
  clickOnly?: boolean
  title?: string
  action?: string
  // The segment's sign and its accessible name.
  segment?: 'plus' | 'minus'
  segmentLabel?: string
}>()

const emit = defineEmits<{
  select: [key: string]
  action: []
  clear: []
  segment: []
  open: []
  delete: [key: string]
  rename: [key: string, name: string]
}>()

defineSlots<{
  icon?(): unknown
  trigger?(): unknown
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
const { armed, confirm, disarm } = useArmedConfirm()
const {
  editingKey,
  editingName,
  setInput,
  start: startRename,
  commit: commitRename,
  cancel: cancelRename,
} = useInlineRename({
  currentName: (key) => items.find((item) => item.key === key)?.label,
  rename: (key, name) => emit('rename', key, name),
})
const listMaxHeight = usePanelFit(listRef, () => open.value && !floating)
const floatingStyle = useFloatingPanel(rootRef, listRef, () => open.value && floating)

// A list on <body> leaves the data-theme region it opened in (a page that keeps
// one look), so it takes that region's look along.
const regionTheme = (): string | undefined => {
  const region = rootRef.value?.closest('[data-theme]')
  if (!region || region === document.documentElement) return undefined
  return region.getAttribute('data-theme') ?? undefined
}

const clearing = computed(() => clearable && lit)

// Pressing the clear button uncovers the trigger under the pointer; hover
// stays off until the pointer leaves, or the list would reopen at once.
let hoverPaused = false
const hoverTrigger = (): void => {
  if (!clickOnly && !hoverPaused) onMouseEnter()
}
// The pointer leaving mid-rename must not close the list under the field.
const leaveList = (): void => {
  if (editingKey.value === null) onMouseLeave()
}
const leave = (): void => {
  hoverPaused = false
  leaveList()
}

const tabbable = (el: HTMLElement | undefined): HTMLElement[] =>
  el ? [...el.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')] : []

const focusTrigger = (): void =>
  (triggerRef.value ?? tabbable(rootRef.value)[0])?.focus({ preventScroll: true })

// A closing list takes its rows off the page, and focus on one of them would
// fall to <body>, so the trigger takes it. Focus a click has already moved
// elsewhere stays there.
watch(open, (isOpen) => {
  if (isOpen) emit('open')
  else {
    disarm()
    // A rename keeps its name when the list closes, as when its field loses focus.
    commitRename()
    if (listRef.value?.contains(document.activeElement)) focusTrigger()
  }
})

// The field leaves with the rename, and focus in it would fall to <body>.
const endRename = (end: () => void): void => {
  end()
  focusTrigger()
}

// Without preventDefault the Enter would go on to press the trigger, which
// has focus by then, and close the list.
const renameEnter = (e: KeyboardEvent): void => {
  if (isComposing(e)) return
  e.preventDefault()
  endRename(commitRename)
}

/* Esc mid-rename cancels it and leaves the list open. The dropdown closes on
   Esc in the document's capture phase, ahead of the field, so the window,
   which hears it first, takes it. Esc ending a composition only stops there. */
const renameEsc = (e: KeyboardEvent): void => {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (!isComposing(e)) endRename(cancelRename)
}
watch(editingKey, (key) => {
  if (key === null) window.removeEventListener('keydown', renameEsc, true)
  else window.addEventListener('keydown', renameEsc, true)
})
onUnmounted(() => window.removeEventListener('keydown', renameEsc, true))

/* A floating list sits at the end of <body>, outside the Tab order. Tab from
   the dropdown's last control enters it, and Tab or Shift+Tab off either end
   comes back to that control, the order an in-place list has. */
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
// leaving it for the trigger would start the close timer. A click in a
// floating list stops there, since the surface around the dropdown would take
// it for an outside click and close.
const listEvents = floating
  ? {
      mouseenter: onMouseEnter,
      mouseleave: leaveList,
      keydown: tabOutOfList,
      click: (e: MouseEvent) => e.stopPropagation(),
    }
  : {}

const select = (item: DropdownItem, e: MouseEvent): void => {
  if ((item.to || item.href) && opensElsewhere(e)) return
  hide()
  emit('select', item.key)
}

const deleteItem = (item: DropdownItem, e: MouseEvent): void => {
  if (!confirm(item.key)) return
  // The button leaves with its row, and focus on it would fall to <body>.
  if (document.activeElement === e.currentTarget) focusTrigger()
  emit('delete', item.key)
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
    <slot name="trigger">
      <button
        ref="triggerRef"
        type="button"
        class="trigger"
        :class="{ lit, clearing }"
        :title
        :aria-label="variant === 'icon' ? label : undefined"
        :aria-expanded="open"
        @click="toggle"
        @mouseenter="hoverTrigger"
      >
        <slot name="icon" />
        <span class="trigger-label">{{ label }}</span>
        <span v-if="!clearing" class="caret">▾</span>
      </button>
    </slot>
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
      <IconPlus v-if="segment === 'plus'" />
      <IconMinus v-else />
    </button>
    <!-- The variant class is repeated on the list: on <body> it has no root
         to take the variant's type size and colours from. -->
    <Teleport to="body" :disabled="!floating">
      <div
        v-if="open"
        ref="listRef"
        class="list"
        :class="[variant, { floating, custom: $slots.default }]"
        :style="floating ? floatingStyle : { maxHeight: listMaxHeight }"
        :data-theme="floating ? regionTheme() : undefined"
        v-on="listEvents"
      >
        <slot :close="hide">
          <template v-for="item in items" :key="item.key">
            <!-- Beside the row, not in it: a button cannot hold another button.
                 Other rows stay unwrapped, so neighbouring selected rows join. -->
            <div
              v-if="item.deletable || item.renamable"
              class="item-wrap"
              :class="{ selected: item.selected }"
              :style="{ '--item-actions': [item.deletable, item.renamable].filter(Boolean).length }"
            >
              <input
                v-if="editingKey === item.key"
                :ref="setInput"
                v-model="editingName"
                class="item-rename"
                :maxlength="MAX_NAME_LENGTH"
                :aria-label="i18n.t('app.rename')"
                @keydown.enter="renameEnter"
                @blur="commitRename"
              />
              <template v-else>
                <DropdownRow
                  class="item"
                  :label="item.label"
                  :meta="item.meta"
                  :meta-color="item.metaColor"
                  :selected="item.selected"
                  :to="item.to"
                  :href="item.href"
                  @click="select(item, $event)"
                />
                <span class="item-actions">
                  <button
                    v-if="item.renamable"
                    type="button"
                    class="item-action"
                    :title="i18n.t('app.rename')"
                    :aria-label="i18n.t('app.rename')"
                    @click="startRename(item.key, item.label)"
                  >
                    <IconEdit :size="11" />
                  </button>
                  <button
                    v-if="item.deletable"
                    type="button"
                    class="item-action item-delete"
                    :class="{ 'confirm-armed': armed === item.key }"
                    :title="armed === item.key ? i18n.t('app.confirm') : i18n.t('app.delete')"
                    :aria-label="armed === item.key ? i18n.t('app.confirm') : i18n.t('app.delete')"
                    @click="deleteItem(item, $event)"
                  >
                    <IconTrashSmall :size="11" />
                  </button>
                </span>
              </template>
            </div>
            <DropdownRow
              v-else
              class="item"
              :label="item.label"
              :meta="item.meta"
              :meta-color="item.metaColor"
              :selected="item.selected"
              :to="item.to"
              :href="item.href"
              @click="select(item, $event)"
            />
          </template>
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
  font: inherit;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pill .trigger,
.tab .trigger,
.dark .trigger {
  width: var(--dropdown-trigger-width, auto);
  min-width: var(--dropdown-trigger-min-width, auto);
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

.item-wrap {
  position: relative;
}

.item-wrap > .item {
  padding-right: calc(2 * var(--spacing-sm) + var(--item-actions) * var(--item-action-size));
}

.item-actions {
  position: absolute;
  top: 50%;
  right: var(--spacing-sm);
  display: flex;
  translate: 0 -50%;
}

.item-action {
  display: grid;
  place-items: center;
  width: var(--item-action-size);
  height: var(--item-action-size);
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  opacity: 0.55;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.item-wrap.selected .item-action {
  color: #fff;
}

.item-action:hover,
.item-action:focus-visible {
  background: color-mix(in srgb, currentColor 18%, transparent);
  opacity: 1;
}

.item-delete:hover,
.item-delete:focus-visible,
.item-delete.confirm-armed {
  background: var(--color-danger);
  color: #fff;
  opacity: 1;
}

.item-delete.confirm-armed {
  background: var(--color-danger-hover);
}

.item-rename {
  display: block;
  width: 100%;
  min-width: 0;
  padding: calc(var(--spacing-sm) - 2px) calc(var(--spacing-md) - 2px);
  border: 2px solid var(--color-primary);
  border-radius: var(--dropdown-row-radius);
  background: var(--color-bg-raised);
  color: var(--color-text-primary);
  font: inherit;
  font-size: max(1em, var(--field-min-font-size));
  font-weight: 600;
  line-height: 1lh;
}

.item-rename:focus {
  outline: none;
}

.list {
  --item-action-size: 22px;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  max-width: 16rem;
  padding: var(--dropdown-list-padding);
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
  background: var(--color-bg-raised);
}

.pill .trigger {
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-raised);
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
  --dropdown-segment-reach: calc(var(--pill-segment-width) + var(--pill-large-border));
}

.segment {
  position: absolute;
  top: var(--pill-large-border);
  right: var(--pill-large-border);
  bottom: var(--pill-large-border);
  display: grid;
  place-items: center;
  width: var(--pill-segment-width);
  padding: 0;
  border: none;
  border-left: var(--pill-large-border) solid var(--color-border-primary);
  border-radius: 0 999px 999px 0;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--pill-segment-font-size);
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
}

/* A press replaces the sign. As the click's target it would be off the page
   before the click reaches the host, which could not tell a button was hit. */
.segment > * {
  pointer-events: none;
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

/* ---- dark ---- */

.dark {
  font-size: var(--field-dark-font-size);
}

.dark .trigger {
  border: var(--field-dark-border);
  border-radius: var(--field-dark-radius);
  background: var(--field-dark-background);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  padding: var(--field-dark-padding);
}

.dark .trigger:hover,
.dark .trigger.lit {
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}

.dark .list {
  max-width: 100%;
}

.list.dark,
.list.icon,
.list.nav {
  background: rgb(32, 32, 32);
  border-color: rgba(255, 255, 255, 0.15);
}

.dark .item,
.dark .item.action,
.dark .item-action,
.icon .item,
.icon .item-action,
.nav .item,
.nav .item-action {
  color: rgba(255, 255, 255, 0.8);
}

.dark .item-rename,
.icon .item-rename,
.nav .item-rename {
  background: var(--field-dark-background);
  color: #fff;
}

.dark .item:hover,
.icon .item:hover,
.nav .item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dark .item.selected,
.icon .item.selected,
.nav .item.selected {
  background: var(--color-primary);
  color: #fff;
}

/* ---- icon ---- */

.icon {
  font-size: var(--control-font-size);
}

/* As a block, the root gains a text line's descent under the icon. */
.dropdown.icon {
  display: inline-flex;
}

.dropdown.icon .trigger {
  padding: 0;
  border: none;
  background: none;
  color: inherit;
}

.icon .trigger-label,
.icon .caret {
  display: none;
}

.icon .list {
  right: 0;
  left: auto;
}

/* ---- nav ---- */

.nav {
  font-size: var(--control-font-size);
}

.dropdown.nav {
  display: flex;
}
</style>
