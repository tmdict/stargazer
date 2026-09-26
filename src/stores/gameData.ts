import { readonly, ref } from 'vue'
import { defineStore } from 'pinia'

import { isCompanionUnitId, toBaseHeroId } from '@/lib/characters/character'
import {
  inPhantimalBand,
  isPhantimalId,
  phantimalOwnerId,
  toLocalPhantimalId,
} from '@/lib/characters/phantimal'
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
    // Phantimals carry their own range in data (a companion falls back to its
    // owner's); melee if missing.
    if (inPhantimalBand(characterId)) {
      const ownerId = phantimalOwnerId(characterId)
      const companionRange = isPhantimalId(characterId)
        ? undefined
        : getCharacterSkill(ownerId)?.companionRange
      return companionRange ?? getPhantimalById(ownerId)?.range ?? 1
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

  // Slug of a phantimal-band unit, which names its remote portrait: the
  // phantimal's own, or for a companion the owner skill's companion image
  // (falling back to the owner's portrait).
  const getPhantimalUnitSlug = (unitId: number): string | undefined => {
    const ownerId = phantimalOwnerId(unitId)
    const ownerName = getPhantimalById(ownerId)?.name
    if (isPhantimalId(unitId) || ownerName === undefined) return ownerName
    return getCharacterSkill(ownerId)?.companionImageModifier ?? ownerName
  }

  const getCharacterNameById = (characterId: number): string | undefined => {
    if (inPhantimalBand(characterId)) return getPhantimalUnitSlug(characterId)
    return getCharacterById(toBaseHeroId(characterId))?.name
  }

  // Portrait image name for a unit id: a companion uses its skill's static
  // companion image when one is defined (e.g. Zanie's turret), otherwise its
  // main hero's portrait, matching what the live grid renders.
  const getCharacterImageNameById = (characterId: number): string | undefined => {
    if (inPhantimalBand(characterId)) return getPhantimalUnitSlug(characterId)
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

  // Whether a phantimal-band unit's seasonal skill targeting is switched on in
  // its phantimal's data file (a companion answers for its owner).
  const hasSeasonalTargeting = (unitId: number): boolean =>
    inPhantimalBand(unitId) && getPhantimalById(phantimalOwnerId(unitId))?.targeting === true

  // Resolves a grid unit's faction by ID, mapping companions and synergy copies
  // to their base hero and phantimal-band units to their phantimal's faction.
  const getCharacterFaction = (characterId: number): string | undefined => {
    if (inPhantimalBand(characterId)) {
      return getPhantimalById(phantimalOwnerId(characterId))?.faction
    }
    return getCharacterById(toBaseHeroId(characterId))?.faction
  }

  // Resolves a grid unit's class by ID, mapping companions and synergy copies
  // to their base hero. Phantimal-band units carry no class.
  const getCharacterClass = (characterId: number): string | undefined => {
    if (inPhantimalBand(characterId)) return undefined
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
    getPhantimalUnitSlug,
    hasSeasonalTargeting,
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
