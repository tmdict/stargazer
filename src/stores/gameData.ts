import { readonly, ref } from 'vue'
import { defineStore } from 'pinia'

import { isCompanionUnitId, toBaseHeroId } from '@/lib/characters/character'
import { isPhantimalId, toLocalPhantimalId } from '@/lib/characters/phantimal'
import { getCharacterSkill } from '@/lib/skills/skill'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { LocaleData } from '@/lib/types/i18n'
import type { PhantimalType } from '@/lib/types/phantimal'
import { loadAllData } from '@/utils/dataLoader'

export const useGameDataStore = defineStore('gameData', () => {
  // Data state
  const characters = ref<CharacterType[]>([])
  const artifacts = ref<ArtifactType[]>([])
  const phantimals = ref<PhantimalType[]>([])
  const characterImages = ref<Record<string, string>>({})
  const artifactImages = ref<Record<string, string>>({})
  const icons = ref<Record<string, string>>({})
  const artifactEffects = ref<Record<string, LocaleData[]>>({})
  const dataLoaded = ref(false)

  // Character ranges - internal state
  const characterRanges = ref(new Map<number, number>())

  const loadIntoState = () => {
    const data = loadAllData()
    characters.value = data.characters
    artifacts.value = data.artifacts
    phantimals.value = data.phantimals
    characterImages.value = data.characterImages
    artifactImages.value = data.artifactImages
    icons.value = data.icons
    artifactEffects.value = data.artifactEffects
    characterRanges.value = data.characterRanges
    dataLoaded.value = true
  }

  // Client-only loader for the interactive game (home/share): skipped during
  // SSG so the pre-rendered grid stays empty until hydration.
  const initializeData = () => {
    if (dataLoaded.value || import.meta.env.SSR) {
      return
    }
    try {
      loadIntoState()
    } catch (error) {
      console.error('Failed to initialize data:', error)
    }
  }

  // SSG-safe loader for content pages (the skill browser): runs during SSG too
  // so the character grid (and its crawlable skill links) is baked into the
  // static HTML and hydrates without a mismatch.
  const initializeContentData = () => {
    if (dataLoaded.value) {
      return
    }
    try {
      loadIntoState()
    } catch (error) {
      console.error('Failed to initialize content data:', error)
    }
  }

  const getCharacterRange = (characterId: number): number => {
    // Phantimals carry their own range in data; fall back to melee if missing.
    if (isPhantimalId(characterId)) {
      return getPhantimalById(characterId)?.range ?? 1
    }
    const baseId = toBaseHeroId(characterId)
    if (isCompanionUnitId(characterId)) {
      const companionRange = getCharacterSkill(baseId)?.companionRange
      if (companionRange !== undefined) return companionRange
    }
    return characterRanges.value.get(baseId) ?? 1
  }

  const getCharacterById = (characterId: number): CharacterType | undefined => {
    return characters.value.find((char) => char.id === characterId)
  }

  const getCharacterNameById = (characterId: number): string | undefined => {
    if (isPhantimalId(characterId)) {
      return getPhantimalById(characterId)?.name
    }
    return getCharacterById(toBaseHeroId(characterId))?.name
  }

  // Portrait image name for a unit id: a companion uses its skill's static
  // companion image when one is defined (e.g. Zanie's turret), otherwise its
  // main hero's portrait, matching what the live grid renders.
  const getCharacterImageNameById = (characterId: number): string | undefined => {
    if (isCompanionUnitId(characterId)) {
      const custom = getCharacterSkill(toBaseHeroId(characterId))?.companionImageModifier
      if (custom) return custom
    }
    return getCharacterNameById(characterId)
  }

  const getArtifactById = (artifactId: number): ArtifactType | undefined => {
    return artifacts.value.find((artifact) => artifact.id === artifactId)
  }

  // Helper to get phantimal by ID (accepts the namespaced grid ID or the local ID)
  const getPhantimalById = (phantimalId: number): PhantimalType | undefined => {
    const localId = isPhantimalId(phantimalId) ? toLocalPhantimalId(phantimalId) : phantimalId
    return phantimals.value.find((phantimal) => phantimal.id === localId)
  }

  // Resolves a grid unit's faction by ID, mapping companions and synergy copies
  // to their base hero and phantimals to their own faction.
  const getCharacterFaction = (characterId: number): string | undefined => {
    if (isPhantimalId(characterId)) return getPhantimalById(characterId)?.faction
    return getCharacterById(toBaseHeroId(characterId))?.faction
  }

  // Resolves a grid unit's class by ID, mapping companions and synergy copies
  // to their base hero. Phantimals carry no class.
  const getCharacterClass = (characterId: number): string | undefined => {
    if (isPhantimalId(characterId)) return undefined
    return getCharacterById(toBaseHeroId(characterId))?.class
  }

  // Safe accessors for images and icons
  const getCharacterImage = (name: string): string => {
    // Placeholder units have no portrait; their name doubles as an icon key
    // (faction-lightbearer).
    return characterImages.value[name] ?? icons.value[name] ?? ''
  }

  const getArtifactImage = (name: string): string => {
    return artifactImages.value[name] ?? ''
  }

  const getArtifactEffects = (name: string): LocaleData[] => {
    return artifactEffects.value[name] ?? []
  }

  const getIcon = (key: string): string => {
    return icons.value[key] ?? ''
  }

  return {
    // State (readonly)
    characters: readonly(characters),
    artifacts: readonly(artifacts),
    phantimals: readonly(phantimals),
    characterImages: readonly(characterImages),
    artifactImages: readonly(artifactImages),
    icons: readonly(icons),
    artifactEffects: readonly(artifactEffects),
    dataLoaded: readonly(dataLoaded),

    // Actions
    initializeData,
    initializeContentData,
    getCharacterRange,
    getCharacterById,
    getCharacterNameById,
    getCharacterImageNameById,
    getArtifactById,
    getPhantimalById,
    getCharacterFaction,
    getCharacterClass,
    getCharacterImage,
    getArtifactImage,
    getArtifactEffects,
    getIcon,

    // Expose for other stores
    characterRanges: readonly(characterRanges),
  }
})
