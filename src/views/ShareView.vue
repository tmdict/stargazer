<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'

import DragDropProvider from '@/components/DragDropProvider.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import BoardsRow from '@/components/teams/BoardsRow.vue'
import IconClose from '@/components/ui/IconClose.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useToast } from '@/composables/useToast'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useUrlStateStore } from '@/stores/urlState'
import { teamsBoardSize } from '@/utils/teamsBoardSize'
import { decodeMultiGridStateFromUrl, getEncodedStateFromRoute } from '@/utils/urlStateManager'

import '@/styles/modal.css'

const gridStore = useGridStore()
const grids = useGrids()
const gameDataStore = useGameDataStore()
const i18nStore = useI18nStore()
const urlStateStore = useUrlStateStore()
const { success } = useToast()
const route = useRoute()

// /share carries either a single-board (Arena) binary state or a 5 v 5 JSON state;
// decodeMulti returns null for the former, which selects the render mode.
const encodedAtLoad = getEncodedStateFromRoute(route.query)
const isMultiBoard = ref(
  encodedAtLoad !== null && decodeMultiGridStateFromUrl(encodedAtLoad) !== null,
)

// Multi reuses the Teams board sizing; single keeps the Arena breakpoint sizing.
if (isMultiBoard.value) {
  grids.hexSizeMode = 'fixed-medium'
} else {
  if (grids.contexts.length !== 1) grids.setGridCount(1)
  grids.hexSizeMode = 'breakpoint'
}
const activeContext = computed(() => grids.active!)

// Set canonical link for share page
useHead({
  title: 'Share | Stargazer',
  link: [{ rel: 'canonical', href: 'https://stargazer.tmdict.com/share' }],
})

// Breakpoint drives responsive sizing only (don't auto-flatten on mobile). Multi
// pins the Teams board size per breakpoint; single is sized by useBreakpoint.
const { currentBreakpoint } = useBreakpoint({ autoFlattenOnMobile: false })
const canWrap = computed(() => currentBreakpoint.value === 'desktop')
const applyMultiSize = () => {
  if (isMultiBoard.value) grids.hexSize = teamsBoardSize(currentBreakpoint.value)
}
applyMultiSize()
watch(currentBreakpoint, applyMultiSize)

const hasValidGrid = ref(false)
const showArrows = ref(false)
const showGridInfo = ref(false)
const showPerspective = ref(false) // Default to flat view
const showSkills = ref(true)
const wrapBoards = ref(false) // 5 v 5 only: 3-2 layout vs one row

// Initialize data immediately (synchronous)
gameDataStore.initializeData()
i18nStore.initialize()

// Restore state from URL
const restoreStateFromUrl = () => {
  const result = isMultiBoard.value
    ? urlStateStore.restoreMultiFromEncodedState(encodedAtLoad)
    : urlStateStore.restoreFromEncodedState(encodedAtLoad)

  if (result.success) {
    // Apply display flags if present
    if (result.displayFlags) {
      showGridInfo.value = result.displayFlags.showGridInfo ?? false
      showArrows.value = result.displayFlags.showArrows ?? false
      showPerspective.value = result.displayFlags.showPerspective ?? false
      showSkills.value = result.displayFlags.showSkills ?? true
      gridStore.teamView = result.displayFlags.teamView ?? false
      gridStore.inverted = result.displayFlags.inverted ?? false
      // Wrap is a 5-board layout; a stray wrap bit on a smaller payload is
      // ignored (BoardsRow degrades gracefully anyway; this is cosmetic).
      wrapBoards.value = (result.displayFlags.wrap ?? false) && grids.contexts.length === 5
    }

    return true
  }

  return false
}

// Check for valid grid state on mount
onMounted(() => {
  if (gameDataStore.dataLoaded) {
    hasValidGrid.value = restoreStateFromUrl()
  }

  // Check if we came from copy link action
  if (history.state?.linkCopied) {
    success(i18nStore.t('app.copied-clipboard'))
  }
})

// The pencil opens this shared setup in its editable page (Arena for a single
// board, the 5 v 5 boards for multi), which overwrites that page's saved state.
// Dismissing (backdrop / close) instead goes to the bare page, leaving it untouched.
const dismissLink = computed(() => (isMultiBoard.value ? '/teams' : '/'))
const editLink = computed(() =>
  encodedAtLoad ? `${dismissLink.value}?g=${encodedAtLoad}` : dismissLink.value,
)
</script>

<template>
  <div class="overlay">
    <!-- Backdrop dismiss: back to the saved page, not the shared setup. -->
    <a :href="dismissLink" class="backdrop-link" aria-label="Back to Stargazer"></a>

    <!-- Content container -->
    <div v-if="hasValidGrid" class="grid-wrapper" :class="{ multi: isMultiBoard }" @click.stop>
      <!-- Edit opens the shared setup in its editable page; close dismisses to it. -->
      <div class="buttons">
        <a :href="editLink" class="button" aria-label="Edit in Stargazer" title="Edit">
          <IconEdit :size="18" />
        </a>
        <a
          :href="dismissLink"
          class="button"
          aria-label="Back to Stargazer"
          title="Back to Stargazer"
        >
          <IconClose />
        </a>
      </div>

      <DragDropProvider>
        <!-- Multi (5 v 5) reuses the Teams boards row, including the 3-2 wrap layout. -->
        <BoardsRow v-if="isMultiBoard" :wrap="wrapBoards" :can-wrap>
          <div v-for="ctx in grids.contexts" :key="ctx.id" class="share-board">
            <GridContainer
              :context="ctx"
              :characters="gameDataStore.characters"
              :show-arrows
              :show-grid-info
              :show-debug="false"
              :show-skills
              :show-perspective
              :readonly="true"
            />
            <TeamPowerPanel v-if="showGridInfo" :context="ctx" readonly />
          </div>
        </BoardsRow>
        <div v-else class="share-board">
          <GridContainer
            :context="activeContext"
            :characters="gameDataStore.characters"
            :show-arrows
            :show-grid-info
            :show-debug="false"
            :show-skills
            :show-perspective
            :readonly="true"
          />
          <TeamPowerPanel v-if="showGridInfo" :context="activeContext" readonly />
        </div>
      </DragDropProvider>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <p>{{ i18nStore.t('app.share-invalid') }}</p>
      <a href="/" class="rowan-link" aria-label="Stargazer" title="Stargazer">
        <img src="@/assets/rowan.gif" alt="logo" class="rowan-gif" />
      </a>
    </div>
  </div>

  <!-- Toast Container -->
  <ToastContainer />
</template>

<style scoped>
/* Grid wrapper - uses modal container styles */
.grid-wrapper {
  position: relative;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  padding: 10px;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Multi-board (5 v 5): let the boards row own the width and scroll horizontally
   (and grow to two rows when wrapped) rather than centering a single grid. */
.grid-wrapper.multi {
  display: block;
  max-width: 95vw;
}

/* Each board stacks its grid over its read-only team-power panel. */
.share-board {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* The panel is built for light pages; on the dark share modal give it a translucent
   light surface so the captions and numbers stay legible without glaring white. */
.share-board :deep(.team-power) {
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
}

/* Empty state styling */
.empty-state {
  position: relative;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 60px 40px;
  text-align: center;
  z-index: 1;
}

.empty-state p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  margin: 0 0 24px 0;
}

.rowan-link {
  display: inline-block;
  text-decoration: none;
  transition: transform 0.2s ease;
}

.rowan-link:hover {
  transform: scale(1.05);
}

.rowan-gif {
  display: block;
  width: 120px;
  height: auto;
  border-radius: 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .overlay {
    align-items: flex-start;
  }

  .grid-wrapper {
    margin: 80px 20px;
  }

  .empty-state {
    padding: 40px 20px;
  }
}

@media (max-width: 480px) {
  .overlay {
    align-items: flex-start;
  }

  .grid-wrapper {
    margin: 80px 4px;
    padding: 4px;
  }

  .empty-state {
    padding: 30px 15px;
  }

  .empty-state p {
    font-size: 16px;
  }
}
</style>
