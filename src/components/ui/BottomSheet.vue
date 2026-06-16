<script setup lang="ts">
import { computed, watch } from 'vue'

import { useBottomSheet } from '@/composables/useBottomSheet'
import { useScrollLock } from '@/composables/useScrollLock'

// Shared roster panel for the grid (`HomeView`), skills (`SkillsBrowser`), and
// guide (`GuideView`) pages: a card column on desktop, a drag-to-resize
// pull-up sheet on mobile.
// The slot holds the page's content (tabs / roster); its own fill + scroll
// stays in the page since each content component scrolls differently.
const {
  peek = 56,
  expandedFraction = 0.62,
  initialExpanded = false,
  desktopRail = true,
} = defineProps<{
  /** Collapsed (peek) visible height on mobile, in px. */
  peek?: number
  /** Expanded visible height as a fraction of the viewport. */
  expandedFraction?: number
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
  isMobile,
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
} = useBottomSheet({ peek, expanded: expandedFraction, initialExpanded })

// CSS vars so the pre-mount CSS fallback derives from the same props the
// composable uses (single source of truth; SSR-safe). The composable overrides
// height/transform inline once mounted. Mirrors its fraction(<1)/px(>=1) units.
const sheetVars = computed(() => ({
  '--sheet-peek': `${peek}px`,
  '--sheet-expanded':
    expandedFraction < 1 ? `${expandedFraction * 100}vh` : `${expandedFraction}px`,
}))

watch(sheetExpanded, (v) => (expanded.value = v))
watch(expanded, (v) => (sheetExpanded.value = !!v), { immediate: true })

// Lock the page behind while the sheet is expanded on mobile, so dragging the
// scrim (or anywhere off the sheet) can't scroll the page underneath. No-op on
// desktop, where the sheet is a static column.
useScrollLock(computed(() => isMobile.value && expanded.value))

const onScrimClick = () => {
  sheetExpanded.value = false
  emit('dismiss')
}

// Imperative open for "tap the empty content to reveal the roster" — a no-op on
// desktop, where the roster column is always visible (there's no sheet).
const expand = () => {
  if (isMobile.value) sheetExpanded.value = true
}
defineExpose({ expand })

// While collapsed, the peek shows the top of the content (e.g. the tabs). Swallow
// clicks there in the capture phase so a tap only expands the sheet instead of
// also triggering the control underneath. Swipe-to-expand is unaffected (touch
// events, not clicks). No-op when expanded or on desktop.
const onCollapsedClickCapture = (e: MouseEvent) => {
  if (expanded.value || !isMobile.value) return
  e.stopPropagation()
  e.preventDefault()
  sheetExpanded.value = true
}
</script>

<template>
  <!-- Tap-scrim behind the expanded sheet (mobile only); a tap collapses it. -->
  <div v-if="expanded && isMobile" class="sheet-scrim" @click="onScrimClick" />
  <div
    class="bottom-sheet"
    :class="{
      'is-dragging': dragging,
      'is-snapping': snapping,
      'is-collapsed': !expanded,
      'desktop-rail': desktopRail,
    }"
    :style="[sheetVars, sheetStyle]"
    @click.capture="onCollapsedClickCapture"
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
/* Desktop: a plain card column (matches base.css `.section` chrome). */
.bottom-sheet {
  width: 100%;
  /* Horizontal uses the shared token so a plain roster's inset matches a TabView's. */
  padding: 2em var(--content-padding-x);
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-large);
  display: flex;
  flex-direction: column;
  /* TabView reads these to bleed its strip to the card edge. */
  --tabview-inset-y: 2em;
  --tabview-inset-x: var(--content-padding-x);
}

/* The drag handle only exists in the mobile sheet mode. */
.sheet-handle-area {
  display: none;
}

/* display: contents — hosts the drag listeners without affecting layout, so the
   slotted content stays a direct flex child with its own fill/scroll. */
.sheet-content {
  display: contents;
}

/* Wide screens (side-column use only): height-cap the column so long content
   scrolls within it rather than stretching the page. container queries let the
   slotted content respond to the column's real width. The content flex-fills via
   its own scoped styles (it owns its scroll, which differs per content). Without
   desktopRail the sheet stays a full-width card that flows in the page. */
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

/* Mobile/tablet (<=768px, mirrors TABLET_MAX_WIDTH): the column becomes a pull-up
   sheet. Layout is CSS-driven so SSG markup hydrates without a mismatch;
   useBottomSheet adds the drag transform inline once mounted. */
@media (max-width: 768px) {
  .bottom-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--sheet-expanded);
    padding: 0;
    /* Mobile sheet has no padding to escape. */
    --tabview-inset-y: 0;
    --tabview-inset-x: 0;
    border-radius: var(--radius-large) var(--radius-large) 0 0;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25);
    z-index: 800;
    overflow: hidden;
    /* Collapsed peek before the composable engages; it overrides this inline. */
    transform: translateY(calc(var(--sheet-expanded) - var(--sheet-peek)));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* No transition while dragging, or while snapping to a new viewport size: a
     resize (mobile toolbar show/hide) must reposition the sheet instantly so the
     collapsed peek can't jiggle as height (layout) and transform (compositor)
     animate out of sync. See useBottomSheet's onResize. */
  .bottom-sheet.is-dragging,
  .bottom-sheet.is-snapping {
    transition: none;
  }
  /* Collapsed peek is drag-only — block native scroll so a swipe there drives the
     sheet, not the page (iOS ignores overscroll-behavior on the non-scrollable peek). */
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
    background: rgba(0, 0, 0, 0.22);
  }
}
</style>
