<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import DragDropProvider from '@/components/DragDropProvider.vue'
import GridContainer from '@/components/grid/GridContainer.vue'
import IconClose from '@/components/ui/IconClose.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useToast } from '@/composables/useToast'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'
import { useSkillStore } from '@/stores/skill'
import { useUrlStateStore } from '@/stores/urlState'
import { getEncodedStateFromRoute } from '@/utils/urlStateManager'

import '@/styles/modal.css'

// Use stores
const gridStore = useGridStore()
const gameDataStore = useGameDataStore()
const i18nStore = useI18nStore()
const skillStore = useSkillStore()
const urlStateStore = useUrlStateStore()
const { success } = useToast()
const route = useRoute()

// Use breakpoint for responsive grid sizing only (don't auto-flatten on mobile)
useBreakpoint({ autoFlattenOnMobile: false })

// Connect grid and skill manager
gridStore._getGrid().skillManager = skillStore._getSkillManager()

// State management
const hasValidGrid = ref(false)
const showArrows = ref(false)
const showHexIds = ref(false)
const showPerspective = ref(true)
const showSkills = ref(true)
const encodedState = ref<string>('')

// Initialize data immediately (synchronous)
gameDataStore.initializeData()
i18nStore.initialize()

// Restore state from URL
const restoreStateFromUrl = () => {
  const encoded = getEncodedStateFromRoute(route.query)
  const result = urlStateStore.restoreFromEncodedState(encoded)

  if (result.success) {
    // Store the encoded state for generating home link
    if (encoded) {
      encodedState.value = encoded
    }

    // Apply display flags if present
    if (result.displayFlags) {
      showHexIds.value = result.displayFlags.showHexIds ?? false
      showArrows.value = result.displayFlags.showArrows ?? false
      showPerspective.value = result.displayFlags.showPerspective ?? true
      showSkills.value = result.displayFlags.showSkills ?? true
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
    success('Copied to clipboard!')
  }
})

// Empty state message
const emptyMessage = computed(() => {
  const queryParam = route.query.g
  if (!queryParam) {
    return 'No grid data provided'
  }
  return 'Invalid grid data'
})

// Home link with encoded state
const homeLink = computed(() => {
  if (encodedState.value) {
    return `/?g=${encodedState.value}`
  }
  return '/'
})
</script>

<template>
  <div class="overlay">
    <!-- Backdrop link to home -->
    <a :href="homeLink" class="backdrop-link" aria-label="Back to Stargazer"></a>

    <!-- Content container -->
    <div v-if="hasValidGrid" class="grid-wrapper" @click.stop>
      <!-- Close button -->
      <div class="buttons">
        <a :href="homeLink" class="button" aria-label="Back to Stargazer" title="Back to Stargazer">
          <IconClose />
        </a>
      </div>

      <!-- Grid Container -->
      <DragDropProvider>
        <GridContainer
          :characters="gameDataStore.characters"
          :show-arrows
          :show-hex-ids
          :show-debug="false"
          :show-skills
          :show-perspective
          :readonly="true"
        />
      </DragDropProvider>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <p>{{ emptyMessage }}</p>
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
    margin: 80px 10px;
  }

  .empty-state {
    padding: 30px 15px;
  }

  .empty-state p {
    font-size: 16px;
  }
}
</style>
