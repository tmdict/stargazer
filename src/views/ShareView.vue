<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'

import DragDropProvider from '@/components/DragDropProvider.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import GridInfoToggle from '@/components/grid/GridInfoToggle.vue'
import TeamPowerPanel from '@/components/grid/TeamPowerPanel.vue'
import BoardsRow from '@/components/teams/BoardsRow.vue'
import IconClose from '@/components/ui/IconClose.vue'
import IconEdit from '@/components/ui/IconEdit.vue'
import { useBoardFit } from '@/composables/useBoardFit'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { deriveGridInfoView, useGridInfoPrefs } from '@/composables/useGridInfoPrefs'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { SITE_ORIGIN } from '@/lib/site'
import { useGameDataStore } from '@/stores/gameData'
import { isNarrowBreakpoint, useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useUrlStateStore } from '@/stores/urlState'
import { teamsBoardSize } from '@/utils/teamsBoardSize'
import { decodeLinkFromUrl, getEncodedStateFromRoute } from '@/utils/urlStateManager'

import '@/styles/content.css'
import '@/styles/modal.css'

const gridStore = useGridStore()
const grids = useGrids()
const gameDataStore = useGameDataStore()
const i18nStore = useI18nStore()
const urlStateStore = useUrlStateStore()
const { success } = useToast()
const route = useRoute()

// The payload names its own mode: arena renders the single-board viewer,
// team modes the multi viewer.
const encodedAtLoad = getEncodedStateFromRoute(route.query)
const linkAtLoad = encodedAtLoad !== null ? decodeLinkFromUrl(encodedAtLoad) : null
const isMultiBoard = ref(linkAtLoad !== null && linkAtLoad.mode !== 'arena')

// Multi reuses the Teams board sizing; single keeps the Arena breakpoint sizing.
if (isMultiBoard.value) {
  grids.hexSizeMode = 'fixed-medium'
} else {
  if (grids.contexts.length !== 1) grids.setGridCount(1)
  grids.hexSizeMode = 'breakpoint'
}
// The viewer opens flat, and a lift made on the page that opened it would
// otherwise stay on this read-only board, controls included.
grids.perspective = false
useSelectionState().clearLiftedHex()
const activeContext = computed(() => grids.active!)

// Set canonical link for share page
useHead({
  title: 'Share | Stargazer',
  meta: [{ property: 'og:url', content: `${SITE_ORIGIN}/share` }],
  link: [{ rel: 'canonical', href: `${SITE_ORIGIN}/share` }],
})

// Breakpoint drives responsive sizing only (don't auto-flatten on mobile). Multi
// pins the Teams board size per breakpoint; single is sized by useBreakpoint, and
// on a phone to the card's width.
const { currentBreakpoint, showPerspective } = useBreakpoint({ autoFlattenOnMobile: false })
const card = ref<HTMLElement>()
useBoardFit(card)
const canWrap = computed(() => !isNarrowBreakpoint(currentBreakpoint.value))
const applyMultiSize = () => {
  if (isMultiBoard.value) grids.hexSize = teamsBoardSize(currentBreakpoint.value)
}
applyMultiSize()
watch(currentBreakpoint, applyMultiSize)

const hasValidGrid = ref(false)
const showSkills = ref(true)
const wrapBoards = ref(false) // 5 v 5 only: 3-2 layout vs one row

// Grid-info visibility is the viewer's own shared pref, not the link's.
const { prefs: gridInfoPrefs } = useGridInfoPrefs()
const info = computed(() => deriveGridInfoView(gridInfoPrefs))

// Initialize data immediately (synchronous)
gameDataStore.initializeData()
i18nStore.initialize()

// Restore state from URL
const restoreStateFromUrl = () => {
  const result =
    isMultiBoard.value && linkAtLoad
      ? urlStateStore.restoreMultiFromDecodedState(linkAtLoad)
      : urlStateStore.restoreFromEncodedState(encodedAtLoad)

  if (result.success) {
    // Apply display flags if present
    if (result.displayFlags) {
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
    <div
      v-if="hasValidGrid"
      ref="card"
      class="grid-wrapper glass-panel"
      :class="{ multi: isMultiBoard }"
    >
      <!-- Edit opens the shared setup in its editable page; close dismisses to it. -->
      <div class="buttons">
        <GridInfoToggle share />
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
              :info
              :show-skills
              :readonly="true"
            />
            <TeamPowerPanel
              v-if="info.heroCard"
              :context="ctx"
              :show-upgrades="info.upgrades"
              readonly
            />
          </div>
        </BoardsRow>
        <div v-else class="share-board">
          <GridContainer
            :context="activeContext"
            :characters="gameDataStore.characters"
            :info
            :show-skills
            :readonly="true"
          />
          <TeamPowerPanel
            v-if="info.heroCard"
            :context="activeContext"
            :show-upgrades="info.upgrades"
            readonly
          />
        </div>
      </DragDropProvider>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state glass-panel">
      <p>{{ i18nStore.t('app.share-invalid') }}</p>
      <a href="/" class="rowan-link" aria-label="Stargazer" title="Stargazer">
        <img src="@/assets/rowan.gif" alt="logo" class="rowan-gif" />
      </a>
    </div>
  </div>
</template>

<style scoped>
.grid-wrapper {
  padding: 56px 10px 10px;
  /* The overlay's align-items: center would center a box taller than the
     overlay too, leaving its top half beyond scroll reach; auto margins
     collapse instead, so the box starts at the top and scrolls. */
  margin: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* As a flex item its automatic minimum width would be the full five-board row,
   so zero it to let the box shrink to the overlay. */
.grid-wrapper.multi {
  display: block;
  min-width: 0;
}

.share-board {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.share-board :deep(.team-power) {
  background: color-mix(in srgb, var(--color-bg-raised) 85%, transparent);
  border-radius: 6px;
}

.empty-state {
  box-shadow: none;
  padding: 60px 40px;
  text-align: center;
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

/* On a phone the card spans the overlay, so its width never follows the board.
   The board's box is wider than the screen there and runs past it only as empty
   margin. */
@media (max-width: 480px) {
  .overlay {
    align-items: flex-start;
    overflow-x: hidden;
  }

  .grid-wrapper {
    flex: 1;
    min-width: 0;
    margin: 80px 4px;
    padding: 52px 4px 4px;
  }

  .empty-state {
    padding: 30px 15px;
  }

  .empty-state p {
    font-size: 16px;
  }
}
</style>
