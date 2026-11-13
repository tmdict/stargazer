<script setup lang="ts">
import { computed, watch } from 'vue'

import {
  SHEET_EXPANDED_FRACTION,
  SHEET_PEEK_PX,
  useBottomSheet,
} from '@/composables/useBottomSheet'
import { closeDropdowns } from '@/composables/useDropdown'
import { useScrollLock } from '@/composables/useScrollLock'

// Shared side panel: a card column on desktop, a drag-to-resize pull-up sheet
// on mobile.
// The slot holds the page's content (tabs / hero list); its own fill + scroll
// stays in the page since each content component scrolls differently.
const { initialExpanded = false, desktopRail = true } = defineProps<{
  /** Start expanded (vs. peeked) on first mobile mount. */
  initialExpanded?: boolean
  /**
   * Wide screens: height-cap it as a side column (the two-column Arena layout, so
   * long content scrolls within it). Off = a full-width card that flows in the
   * page below the grid (the single-column 5 v 5 layout). Mobile is a sheet either way.
   */
  desktopRail?: boolean
}>()

// Two-way so the page can open/collapse it (e.g. on a grid-cell tap) while the
// drag gesture writes back through the same model.
const expanded = defineModel<boolean>('expanded', { default: false })

const emit = defineEmits<{ dismiss: [] }>()

const {
  expanded: sheetExpanded,
  narrow,
  justToggled,
  dragging,
  snapping,
  sheetStyle,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onContentTouchStart,
  onContentTouchMove,
  onContentTouchEnd,
  onContentMouseDown,
} = useBottomSheet({ initialExpanded })

// CSS vars so the pre-mount CSS fallback derives from the same sizes the
// composable uses (SSR-safe). The composable overrides height/transform inline
// once mounted.
const sheetVars = {
  '--sheet-peek': `${SHEET_PEEK_PX}px`,
  '--sheet-expanded': `${SHEET_EXPANDED_FRACTION * 100}vh`,
}

watch(sheetExpanded, (v) => (expanded.value = v))
watch(expanded, (v) => (sheetExpanded.value = !!v), { immediate: true })

// A collapsing sheet carries its dropdowns' triggers off screen, and the tap
// or drag that collapsed it is no click outside them.
watch(sheetExpanded, (open) => {
  if (!open && narrow.value) closeDropdowns()
})

// Lock the page behind while the sheet is expanded on mobile, so dragging the
// scrim (or anywhere off the sheet) can't scroll the page underneath. No-op on
// desktop, where the sheet is a static column.
useScrollLock(computed(() => narrow.value && expanded.value))

// The release that expanded the sheet can land its synthesized click on the
// scrim before the glide reaches the finger, dismissing the sheet it just
// opened — hence the justToggled guard.
const onScrimClick = () => {
  if (justToggled()) return
  sheetExpanded.value = false
  emit('dismiss')
}

// Imperative open for "tap the empty content to reveal the panel": a no-op on
// desktop, where the panel column is always visible (there's no sheet).
const expand = () => {
  if (narrow.value) sheetExpanded.value = true
}
defineExpose({ expand })

// While collapsed, the peek shows the top of the content (e.g. the tabs). Swallow
// clicks there in the capture phase so a tap only expands the sheet instead of
// also triggering the control underneath. Swipe-to-expand is unaffected (touch
// events, not clicks). No-op on desktop.
//
// A toggling release also synthesizes a click that hit-tests against content
// slid under the finger mid-glide: it would press whatever landed there (the
// search trigger, a hero) or, after a collapse, re-expand the sheet through
// the peek branch — so the justToggled branch swallows it.
const onSheetClickCapture = (e: MouseEvent) => {
  if (!narrow.value) return
  if (justToggled()) {
    e.stopPropagation()
    e.preventDefault()
    return
  }
  if (expanded.value) return
  e.stopPropagation()
  e.preventDefault()
  sheetExpanded.value = true
}
</script>

<template>
  <div v-if="expanded && narrow" class="sheet-scrim" @click="onScrimClick" />
  <div
    class="bottom-sheet"
    :class="{
      'is-dragging': dragging,
      'is-snapping': snapping,
      'is-collapsed': !expanded,
      'desktop-rail': desktopRail,
    }"
    :style="[sheetVars, sheetStyle]"
    @click.capture="onSheetClickCapture"
  >
    <div
      class="sheet-handle-area"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @mousedown="onMouseDown"
    >
      <span class="sheet-handle" />
    </div>
    <!-- Hosts the overscroll-to-collapse listeners; transparent to layout. -->
    <div
      class="sheet-content"
      @touchstart.passive="onContentTouchStart"
      @touchmove="onContentTouchMove"
      @touchend="onContentTouchEnd"
      @touchcancel="onContentTouchEnd"
      @mousedown="onContentMouseDown"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet {
  width: 100%;
  --tabview-inset-y: 2em;
  --tabview-inset-x: var(--content-padding-x);
  padding: var(--tabview-inset-y) var(--tabview-inset-x);
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-large);
  box-shadow: inset 0 0 0 1px var(--panel-edge);
  display: flex;
  flex-direction: column;
}

.sheet-handle-area {
  display: none;
}

.sheet-content {
  display: contents;
}

@media (min-width: 1220px) {
  .bottom-sheet.desktop-rail {
    flex: 1 1 auto;
    min-width: 0;
    max-height: 100vh;
    container-type: inline-size;
  }
}

.sheet-scrim {
  position: fixed;
  inset: 0;
  z-index: 799;
  background: rgba(0, 0, 0, 0.08);
  animation: sheet-fade-in 0.2s ease;
}
@keyframes sheet-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .bottom-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--sheet-expanded);
    --tabview-inset-y: 0;
    --tabview-inset-x: 0;
    --tabview-side-border: 0;
    --tabview-radius: 0;
    border-radius: var(--radius-large) var(--radius-large) 0 0;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25);
    z-index: 800;
    overflow: hidden;
    transform: translateY(calc(var(--sheet-expanded) - var(--sheet-peek)));
    transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .bottom-sheet.is-dragging,
  .bottom-sheet.is-snapping {
    transition: none;
  }
  .bottom-sheet.is-collapsed {
    touch-action: none;
  }

  .sheet-handle-area {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    touch-action: none;
    cursor: grab;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-contrast) 22%, transparent);
  }
}
</style>
