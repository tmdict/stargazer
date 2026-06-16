<script setup lang="ts">
/* The 5 v 5 grid panel: the global control bar plus the horizontally-scrolling row
   of five boards. It's the #fiveVFive panel of TeamsView's outer TabView; the tab
   strip and the roster live in TeamsView. Boards bind to their own context. */

import GridBoard from '@/components/grid/GridBoard.vue'
import GridControls from '@/components/grid/GridControls.vue'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'

defineProps<{
  characters: readonly CharacterType[]
  // Mobile: tap a cell to target it for the roster sheet; desktop: the on-grid popup.
  tapMode: boolean
}>()

// Display flags are owned by TeamsView (the share link serializes them, the URL
// restore sets them); GridControls writes them and every board reads them.
const showArrows = defineModel<boolean>('showArrows', { required: true })
const showHexIds = defineModel<boolean>('showHexIds', { required: true })
const showPerspective = defineModel<boolean>('showPerspective', { required: true })
const showSkills = defineModel<boolean>('showSkills', { required: true })

const emit = defineEmits<{ copyLink: []; copyImage: []; download: [] }>()

const grids = useGrids()
</script>

<template>
  <div class="teams-boards">
    <GridControls
      :single-row="true"
      v-model:show-arrows="showArrows"
      v-model:show-hex-ids="showHexIds"
      v-model:show-perspective="showPerspective"
      v-model:show-skills="showSkills"
      v-model:team-view="grids.teamView"
      @copy-link="emit('copyLink')"
      @copy-image="emit('copyImage')"
      @download="emit('download')"
    />

    <div v-scroll-chain.horizontal class="boards">
      <!-- .boards-track is the image-export capture root (see TeamsView's boardCapture). -->
      <div class="boards-track">
        <GridBoard
          v-for="ctx in grids.contexts"
          :key="ctx.id"
          :context="ctx"
          :characters="characters"
          :show-arrows="showArrows"
          :show-hex-ids="showHexIds"
          :show-skills="showSkills"
          :show-perspective="showPerspective"
          :tap-mode="tapMode"
        />
      </div>
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

/* The full-width row of boards. Captured as one image (Copy / Download) so every
   board is included even when some are scrolled out of view. flex: 0 0 auto keeps
   its natural width so it overflows (scrolls) instead of shrinking to fit. */
.boards-track {
  display: flex;
  gap: var(--spacing-md);
  flex: 0 0 auto;
}
</style>
