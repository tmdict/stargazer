<script setup lang="ts">
/* The horizontally-scrolling row of 5 v 5 boards, with the optional 3-2 "wrap"
   layout. Layout only: callers slot in the boards (editable GridBoard on the Teams
   page, read-only GridContainer on the share view). `.boards-track` is the
   image-export capture root (see TeamsView's boardCapture). */

const { wrap, canWrap } = defineProps<{
  wrap: boolean
  // Wrap is a desktop-only layout; the row stays single on the narrow (sheet) view.
  canWrap: boolean
}>()
</script>

<template>
  <div v-scroll-chain.horizontal class="boards">
    <div class="boards-track" :class="{ wrap: wrap && canWrap }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* One wide row; scroll horizontally when the boards overflow rather than wrapping.
   `safe center` centers the track when it fits without making the first board's
   start unreachable once it overflows. Top padding keeps the active board's ring
   from being clipped by the scroll container. */
.boards {
  display: flex;
  overflow-x: auto;
  /* Keep horizontal overscroll in the row (the wheel handler contains the
     vertical-wheel case; this covers native trackpad/shift-wheel scrolling). */
  overscroll-behavior-x: contain;
  justify-content: safe center;
  margin-top: var(--spacing-lg);
  padding: 4px 0 var(--spacing-md);
}

/* The TabView bleeds the section's side padding away on the narrow view, so re-add a
   side gutter on the row to match the Arena grid's mobile padding (HomeView). */
@media (max-width: 768px) {
  .boards {
    padding-left: var(--spacing-md);
    padding-right: var(--spacing-md);
  }
}
@media (max-width: 480px) {
  .boards {
    padding-left: var(--spacing-xs);
    padding-right: var(--spacing-xs);
  }
}

/* The full-width row of boards. Captured as one image (Copy / Download) so every
   board is included even when some are scrolled out of view. flex: 0 0 auto keeps
   its natural width so it overflows (scrolls) instead of shrinking to fit. */
.boards-track {
  display: flex;
  gap: var(--spacing-md);
  flex: 0 0 auto;
}

/* "Wrap" layout: the five boards as 3 then 2 over two rows. Board size and the
   horizontal scroll are unchanged; only the arrangement differs, and the capture
   root stays this element so Copy/Download still include all five. With fewer
   than 4 slotted boards (the 1v1/3v3 modes) the :nth-child(4)/(5) rules match
   nothing, so a stray wrap flag degrades to the plain 3-column grid. */
.boards-track.wrap {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  justify-content: center;
}

/* Center the second row (boards 4-5) under the three above. translateX(50%) is half
   a board; with half the gap that is exactly half a column, the shift that centers
   two boards beneath three. The boards are slotted in by the caller (parent scope),
   so :slotted targets them; a bare :nth-child would miss them under scoped CSS. */
.boards-track.wrap > :slotted(:nth-child(4)),
.boards-track.wrap > :slotted(:nth-child(5)) {
  transform: translateX(calc(50% + var(--spacing-md) / 2));
}
</style>
