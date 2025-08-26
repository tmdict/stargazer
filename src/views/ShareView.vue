<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import DragDropProvider from '../components/DragDropProvider.vue'
import GridContainer from '../components/grid/GridContainer.vue'
import IconClose from '../components/ui/IconClose.vue'
import ToastContainer from '../components/ui/ToastContainer.vue'
import { useBreakpoint } from '../composables/useBreakpoint'
import { useStateReset } from '../composables/useStateReset'
import { useToast } from '../composables/useToast'
import { Team } from '../lib/types/team'
import { useArtifactStore } from '../stores/artifact'
import { useCharacterStore } from '../stores/character'
import { useGameDataStore } from '../stores/gameData'
import { useGridStore } from '../stores/grid'
import { useI18nStore } from '../stores/i18n'
import { useSkillStore } from '../stores/skill'
import { unpackDisplayFlags } from '../utils/gridStateSerializer'
import { decodeGridStateFromUrl } from '../utils/urlStateManager'

import '@/styles/modal.css'

// Use stores
const gridStore = useGridStore()
const gameDataStore = useGameDataStore()
const i18nStore = useI18nStore()
const artifactStore = useArtifactStore()
const characterStore = useCharacterStore()
const skillStore = useSkillStore()
const { clearAllState } = useStateReset()
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
  try {
    const encoded = route.query.g
    if (typeof encoded !== 'string' || !encoded) {
      return false
    }

    encodedState.value = encoded

    const urlState = decodeGridStateFromUrl(encoded)
    if (!urlState) {
      return false
    }

    // Clear existing state first
    clearAllState()

    // Restore tile states
    if (urlState.t) {
      urlState.t.forEach(([hexId, state]) => {
        try {
          const hex = gridStore.getHexById(hexId)
          gridStore.setState(hex, state)
        } catch (error) {
          console.warn(`Failed to restore tile state for hex ${hexId}:`, error)
        }
      })
    }

    // Restore character placements
    if (urlState.c) {
      // Separate main characters from companions
      const mainCharacters: typeof urlState.c = []
      const companions: typeof urlState.c = []

      urlState.c.forEach((entry) => {
        const characterId = entry[1]
        if (characterId >= 10000) {
          companions.push(entry)
        } else {
          mainCharacters.push(entry)
        }
      })

      // Place main characters first (this will create companions via skills)
      mainCharacters.forEach(([hexId, characterId, team]) => {
        const placementSuccess = characterStore.placeCharacterOnHex(hexId, characterId, team)
        if (!placementSuccess) {
          console.warn(`Failed to place character ID ${characterId} on hex ${hexId}`)
        }
      })

      // For companions, move them to their correct positions
      companions.forEach((entry) => {
        const targetHexId = entry[0] ?? -1 // -1: invalid target hex ID
        const companionId = entry[1] ?? -1 // -1: invalid companion ID
        const team = entry[2] ?? -1 // -1: invalid team
        if (targetHexId === -1 || companionId === -1 || team === -1) return // Skip invalid entries

        const tiles = gridStore.getAllTiles
        const currentHex = tiles.find(
          (tile) => tile.characterId === companionId && tile.team === team,
        )

        if (currentHex) {
          const currentHexId = currentHex.hex.getId()
          const moveSuccess = characterStore.moveCharacter(currentHexId, targetHexId, companionId)
          if (!moveSuccess) {
            console.warn(
              `Failed to move companion ID ${companionId} from hex ${currentHexId} to ${targetHexId}`,
            )
          }
        }
      })
    }

    // Restore artifacts
    if (urlState.a) {
      const allyArtifact = urlState.a[0] ?? null // null: no ally artifact
      const enemyArtifact = urlState.a[1] ?? null // null: no enemy artifact
      if (allyArtifact !== null) {
        artifactStore.placeArtifact(allyArtifact, Team.ALLY)
      }
      if (enemyArtifact !== null) {
        artifactStore.placeArtifact(enemyArtifact, Team.ENEMY)
      }
    }

    // Restore display flags if present
    const displayFlags = unpackDisplayFlags(urlState.d)
    if (displayFlags) {
      showHexIds.value = displayFlags.showHexIds ?? false
      showArrows.value = displayFlags.showArrows ?? false
      showPerspective.value = displayFlags.showPerspective ?? true
      showSkills.value = displayFlags.showSkills ?? true
    }

    return true
  } catch (err) {
    console.error('Failed to restore state from URL:', err)
    return false
  }
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
        <img src="../assets/rowan.gif" alt="logo" class="rowan-gif" />
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
