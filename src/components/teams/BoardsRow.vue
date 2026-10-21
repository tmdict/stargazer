<script setup lang="ts">
/* The horizontally-scrolling row of team boards, with the optional 3-2 "wrap"
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
  <div class="boards">
    <div class="boards-track" :class="{ wrap: wrap && canWrap }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* `safe center` centers the track when it fits without making the first board's
   start unreachable once it overflows. */
.boards {
  display: flex;
  overflow-x: auto;
  /* A trackpad swipe past the row's end stays in the row instead of triggering
     the browser's back/forward gesture. */
  overscroll-behavior-x: contain;
  justify-content: safe center;
  margin-top: var(--spacing-lg);
  padding: 4px 0 var(--spacing-md);
}

@media (max-width: 768px) {
  .boards {
    padding-left: var(--board-gutter);
    padding-right: var(--board-gutter);
  }
}

.boards-track {
  display: flex;
  gap: var(--spacing-md);
  flex: 0 0 auto;
}

.boards-track.wrap {
  display: grid;
  grid-template-columns: repeat(3, max-content);
  justify-content: center;
}

/* The boards are slotted in by the caller (parent scope), so :slotted targets
   them; a bare :nth-child would miss them under scoped CSS. */
.boards-track.wrap > :slotted(:nth-child(4)),
.boards-track.wrap > :slotted(:nth-child(5)) {
  transform: translateX(calc(50% + var(--spacing-md) / 2));
}
</style>
