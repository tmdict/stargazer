import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'

import type { ArtifactType } from '../lib/types/artifact'
import type { CharacterType } from '../lib/types/character'
import { getCharacterSkill } from '../lib/skill'
import { loadAllData } from '../utils/dataLoader'

export const useGameDataStore = defineStore('gameData', () => {
  // Data state
  const characters = ref<CharacterType[]>([])
  const artifacts = ref<ArtifactType[]>([])
  const characterImages = ref<Record<string, string>>({})
  const artifactImages = ref<Record<string, string>>({})
  const icons = ref<Record<string, string>>({})
  const dataLoaded = ref(false)

  // Character ranges - internal state
  const characterRanges = ref(new Map<number, number>())

  // Initialize all data using dataLoader
  const initializeData = () => {
    // Skip if already loaded or during SSG
    if (dataLoaded.value || import.meta.env.SSR) {
      return
    }

    try {
      const data = loadAllData()

      // Update reactive state
      characters.value = data.characters
      artifacts.value = data.artifacts
      characterImages.value = data.characterImages
      artifactImages.value = data.artifactImages
      icons.value = data.icons
      characterRanges.value = data.characterRanges

      dataLoaded.value = true
    } catch (error) {
      console.error('Failed to initialize data:', error)
    }
  }

  /**
   * Sets character images directly.
   * Used by SSG to inject pre-loaded images during hydration.
   * This allows content pages to display character images without
   * loading the full game data.
   */
  const setCharacterImages = (images: Record<string, string>) => {
    characterImages.value = images
  }

  // Helper to get character range by ID
  const getCharacterRange = (characterId: number): number => {
    // Check if this is a companion ID (10000+)
    if (characterId >= 10000) {
      const mainCharacterId = characterId - 10000
      const skill = getCharacterSkill(mainCharacterId)

      // If the skill defines a companion range, use that
      if (skill?.companionRange !== undefined) {
        return skill.companionRange
      }

      // Otherwise fall back to the main character's range
      return characterRanges.value.get(mainCharacterId) ?? 1
    }

    // Regular character - use standard range
    return characterRanges.value.get(characterId) ?? 1
  }

  // Helper to get character by ID
  const getCharacterById = (characterId: number): CharacterType | undefined => {
    return characters.value.find((char) => char.id === characterId)
  }

  // Helper to get character name by ID
  const getCharacterNameById = (characterId: number): string | undefined => {
    // Handle companion IDs (10000+)
    const actualId = characterId >= 10000 ? characterId % 10000 : characterId
    const character = getCharacterById(actualId)
    return character?.name
  }

  // Helper to get artifact by ID
  const getArtifactById = (artifactId: number): ArtifactType | undefined => {
    return artifacts.value.find((artifact) => artifact.id === artifactId)
  }

  return {
    // State (readonly)
    characters: readonly(characters),
    artifacts: readonly(artifacts),
    characterImages: readonly(characterImages),
    artifactImages: readonly(artifactImages),
    icons: readonly(icons),
    dataLoaded: readonly(dataLoaded),

    // Actions
    initializeData,
    setCharacterImages,
    getCharacterRange,
    getCharacterById,
    getCharacterNameById,
    getArtifactById,

    // Expose for other stores
    characterRanges: readonly(characterRanges),
  }
})
