<script setup lang="ts">
/* The Teams page orchestrator (mirrors WandWarsView): owns the outer tab state and
   the boards. The active tab selects the board count (GRID_TABS), so a future grid
   mode (e.g. 3 v 3) drops in as one entry + a tab + a panel. A single watch on the
   active tab is the only writer of the count; onScopeDispose resets to the Arena's
   one board on leave (synchronously, so an HMR reload can't clobber it). Renders one
   TabView (grid modes / Image Stitcher) inside a card, plus the roster as a separate
   sibling card shown for any grid tab. */

import { computed, onMounted, onScopeDispose, onUnmounted, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'

import DragDropProvider from '@/components/DragDropProvider.vue'
import ImageStitcher from '@/components/teams/ImageStitcher.vue'
import TeamsBoards from '@/components/teams/TeamsBoards.vue'
import TeamsRoster from '@/components/teams/TeamsRoster.vue'
import TabView from '@/components/ui/TabView.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useGridExport } from '@/composables/useGridExport'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { FIVE_V_FIVE_DEFAULT_MAPS } from '@/lib/maps'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useUrlStateStore } from '@/stores/urlState'
import { generateMultiShareableUrl, getEncodedStateFromUrl } from '@/utils/urlStateManager'

// Board size steps down as the window narrows (large desktop / medium tablet /
// small mobile); the row scrolls horizontally so size isn't bound by fitting five.
const LARGE_HEX = { x: 33, y: 33 }
const MEDIUM_HEX = { x: 26, y: 26 }
const MOBILE_HEX = { x: 23, y: 23 }

const grids = useGrids()
const gameDataStore = useGameDataStore()
const i18n = useI18nStore()
const urlStateStore = useUrlStateStore()
const { copyToClipboard, downloadAsImage } = useGridExport()
const { success, error } = useToast()
const { currentBreakpoint } = useBreakpoint({ autoFlattenOnMobile: false })
const { clearTargetHex, clearLiftedHex } = useSelectionState()

gameDataStore.initializeData()
i18n.initialize()

useHead({ title: 'Teams · Stargazer' })

const activeTab = ref('fiveVFive')
// Image Stitcher is a wide-window-only tool: its tab is hidden on mobile.
const tabs = computed(() => [
  { key: 'fiveVFive', label: i18n.t('app.5-v-5') },
  { key: 'imageStitcher', label: 'Image Stitcher', hideMobile: true },
])

// Display flags drive every board (global controls); the share link serializes them.
const showArrows = ref(false)
const showHexIds = ref(false)
const showPerspective = ref(false)
const showSkills = ref(true)

// At sheet widths (<= tablet) the roster is a pull-up sheet and boards place via
// the cell-tap flow; on desktop the roster is a card and cells use the on-grid popup.
const isSheet = computed(() => currentBreakpoint.value !== 'desktop')

// Grid tabs pin their own size per breakpoint, not the breakpoint-driven Arena
// sizing; hexSizeMode tells useBreakpoint to leave the size alone.
const applySize = () => {
  grids.hexSize =
    currentBreakpoint.value === 'mobile'
      ? MOBILE_HEX
      : currentBreakpoint.value === 'tablet'
        ? MEDIUM_HEX
        : LARGE_HEX
}

// Board count per grid tab; the active tab is the selector, so a future mode (e.g.
// 3 v 3) drops in as one entry. Non-grid tabs (Image Stitcher) aren't listed and
// leave the boards untouched.
const GRID_TABS: Record<string, { count: number; maps: string[] } | undefined> = {
  fiveVFive: { count: FIVE_V_FIVE_DEFAULT_MAPS.length, maps: FIVE_V_FIVE_DEFAULT_MAPS },
}
const isGridTab = computed(() => GRID_TABS[activeTab.value] !== undefined)

// The only writer of the board count. Rebuilds only when the active grid tab needs a
// different count (so toggling Image Stitcher and back preserves board state), then
// pins the medium sizing. A rebuild drops any stale tap-target/lift pointing at the
// replaced boards (boards share hex ids).
watch(
  activeTab,
  (tab) => {
    const cfg = GRID_TABS[tab]
    if (!cfg) return
    if (grids.contexts.length !== cfg.count) {
      grids.setGridCount(cfg.count, cfg.maps)
      clearTargetHex()
      clearLiftedHex()
    }
    grids.hexSizeMode = 'fixed-medium'
    applySize()
  },
  { immediate: true },
)
watch(currentBreakpoint, applySize)

// Restore a shared 5 v 5 link (?g=) if one is present.
if (gameDataStore.dataLoaded) {
  const encoded = getEncodedStateFromUrl()
  if (encoded) {
    const result = urlStateStore.restoreMultiFromEncodedState(encoded)
    if (result.success && result.displayFlags) {
      showHexIds.value = result.displayFlags.showHexIds ?? false
      showArrows.value = result.displayFlags.showArrows ?? false
      showPerspective.value = result.displayFlags.showPerspective ?? false
      showSkills.value = result.displayFlags.showSkills ?? true
      grids.teamView = result.displayFlags.teamView ?? false
      success(i18n.t('app.grid-loaded'))
    } else if (result.error && result.error !== 'No state provided') {
      error(i18n.t('app.invalid-url'))
    }
  }
}

// Reset to the Arena's single board on leave. onScopeDispose runs synchronously on
// unmount (before any re-mounted instance's setup), so an HMR reload can't leave the
// count clobbered the way a deferred onUnmounted would.
onScopeDispose(() => {
  grids.setGridCount(1)
  grids.hexSizeMode = 'breakpoint'
  clearTargetHex()
  clearLiftedHex()
})

// Capture all five boards as one image (the full-width track, so boards scrolled
// out of view are still included; drop the per-board clear buttons).
const boardCapture = {
  showPerspective: false,
  target: '.boards-track',
  filter: (node: HTMLElement) => !node.classList?.contains('board-clear'),
  filePrefix: 'teams',
}
const handleCopyImage = () => copyToClipboard(boardCapture)
const handleDownload = () => downloadAsImage(boardCapture)

const handleCopyLink = async () => {
  try {
    const boards = grids.contexts.map((ctx) => ({
      tiles: ctx.grid.getAllTiles(),
      allyArtifact: ctx.artifacts.ally,
      enemyArtifact: ctx.artifacts.enemy,
    }))
    const url = generateMultiShareableUrl(boards, grids.activeId, {
      showHexIds: showHexIds.value,
      showArrows: showArrows.value,
      showPerspective: showPerspective.value,
      showSkills: showSkills.value,
      teamView: grids.teamView,
    })
    await navigator.clipboard.writeText(url)
    success(i18n.t('app.copied-clipboard'))
  } catch (err) {
    console.error('Failed to copy 5 v 5 link:', err)
    error(i18n.t('app.copy-link-failed'))
  }
}

// Image Stitcher is wide-window-only; if the viewport narrows while it's active,
// fall back to 5 v 5 (its tab is hidden, so it would otherwise be a stranded panel).
let mq: MediaQueryList | null = null
const enforceMobileTab = () => {
  if (mq?.matches && activeTab.value === 'imageStitcher') activeTab.value = 'fiveVFive'
}
onMounted(() => {
  mq = window.matchMedia('(max-width: 768px)')
  enforceMobileTab()
  mq.addEventListener('change', enforceMobileTab)
})
onUnmounted(() => mq?.removeEventListener('change', enforceMobileTab))
</script>

<template>
  <main>
    <!-- DragDropProvider wraps both the boards (TabView panel) and the roster sibling
         so characters can be dragged between them. -->
    <DragDropProvider>
      <div class="teams-layout">
        <section class="section">
          <!-- eager: keep the boards panel mounted across tab switches (board state
               lives in the store, but this avoids remount churn + keeps the export
               target rendered). -->
          <TabView v-model="activeTab" :tabs="tabs" eager>
            <template #fiveVFive>
              <TeamsBoards
                v-model:show-arrows="showArrows"
                v-model:show-hex-ids="showHexIds"
                v-model:show-perspective="showPerspective"
                v-model:show-skills="showSkills"
                :characters="gameDataStore.characters"
                :tap-mode="isSheet"
                @copy-link="handleCopyLink"
                @copy-image="handleCopyImage"
                @download="handleDownload"
              />
            </template>
            <template #imageStitcher>
              <h1 class="page-title">Image Stitcher</h1>
              <ImageStitcher />
            </template>
          </TabView>
        </section>

        <TeamsRoster
          v-show="isGridTab"
          :characters="gameDataStore.characters"
          :artifacts="gameDataStore.artifacts"
          :phantimals="gameDataStore.phantimals"
        />
      </div>
    </DragDropProvider>
    <ToastContainer />
  </main>
</template>

<style scoped>
/* Single column: the boards card on top, the roster card/sheet below. */
.teams-layout {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  width: 100%;
}

.page-title {
  margin: 0 0 var(--spacing-lg);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Clear the collapsed roster sheet's peek so page content isn't hidden behind it. */
@media (max-width: 768px) {
  main {
    padding-bottom: 64px;
  }
}
</style>
