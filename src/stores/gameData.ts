import { computed, readonly, ref } from 'vue'
import { defineStore } from 'pinia'

import { isCompanionId, toBaseHeroId } from '@/lib/characters/character'
import {
  inPhantimalBand,
  isPhantimalId,
  phantimalOwnerId,
  toLocalPhantimalId,
} from '@/lib/characters/phantimal'
import { UNIT_LOOKUPS } from '@/lib/characters/unitData'
import { loadArtifacts, loadCharacters, loadPhantimals } from '@/lib/dataLoader'
import { getCharacterSkill } from '@/lib/skills/skill'
import type { ArtifactType } from '@/lib/types/artifact'
import type { CharacterType } from '@/lib/types/character'
import type { PhantimalType } from '@/lib/types/phantimal'
import {
  loadArtifactImages,
  loadCharacterImages,
  loadIcons,
  loadOutfitImages,
} from '@/utils/imageLoader'

export const useGameDataStore = defineStore('gameData', () => {
  // Data state
  const characters = ref<CharacterType[]>([])
  const artifacts = ref<ArtifactType[]>([])
  const phantimals = ref<PhantimalType[]>([])
  const characterImages = ref<Record<string, string>>({})
  const outfitImages = ref<Record<string, string>>({})
  const artifactImages = ref<Record<string, string>>({})
  const icons = ref<Record<string, string>>({})
  const dataLoaded = ref(false)

  const pickerArtifacts = computed(() =>
    [...artifacts.value].sort((a, b) => a.season - b.season || a.id - b.id),
  )

  // Character ranges - internal state
  const characterRanges = ref(new Map<number, number>())

  const loadIntoState = () => {
    const heroes = loadCharacters()
    characters.value = heroes
    artifacts.value = loadArtifacts()
    phantimals.value = loadPhantimals()
    characterImages.value = loadCharacterImages()
    outfitImages.value = loadOutfitImages()
    artifactImages.value = loadArtifactImages()
    icons.value = loadIcons()
    characterRanges.value = new Map(heroes.map(({ id, range }) => [id, range]))
    dataLoaded.value = true
  }

  // Client-only loader for the interactive game (home/share): skipped during
  // SSG so the pre-rendered grid stays empty.
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
  // static HTML.
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
    if (isCompanionId(characterId)) {
      const companionRange = getCharacterSkill(baseId)?.companionRange
      if (companionRange !== undefined) return companionRange
    }
    return characterRanges.value.get(baseId) ?? 1
  }

  const getCharacterById = (characterId: number): CharacterType | undefined => {
    return characters.value.find((char) => char.id === characterId)
  }

  // Slug of a phantimal-band unit, which names its portrait: the phantimal's
  // own, or for a companion the owner skill's companion image (falling back to
  // the owner's portrait).
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

  // Portrait image name for a unit id as the live grid draws it: a companion's
  // skill picture (Zanie's turret, Lailah), or an owner's own picture when its
  // skill names one (Elijah alone), else the hero's portrait.
  const getCharacterImageNameById = (characterId: number): string | undefined => {
    if (inPhantimalBand(characterId)) return getPhantimalUnitSlug(characterId)
    const skill = getCharacterSkill(toBaseHeroId(characterId))
    const own = isCompanionId(characterId) ? skill?.companionImageModifier : skill?.imageModifier
    return own ?? getCharacterNameById(characterId)
  }

  const getArtifactById = (artifactId: number): ArtifactType | undefined => {
    return artifacts.value.find((artifact) => artifact.id === artifactId)
  }

  // Helper to get phantimal by ID (accepts the namespaced grid ID or the local ID)
  const getPhantimalById = (phantimalId: number): PhantimalType | undefined => {
    const localId = isPhantimalId(phantimalId) ? toLocalPhantimalId(phantimalId) : phantimalId
    return phantimals.value.find((phantimal) => phantimal.id === localId)
  }

  // Safe accessors for images and icons
  const getCharacterImage = (name: string): string => {
    // Placeholder units have no portrait; their name doubles as an icon key
    // (faction-lightbearer).
    return characterImages.value[name] ?? icons.value[name] ?? ''
  }

  const getOutfitImage = (name: string): string => outfitImages.value[name] ?? ''

  const getArtifactImage = (name: string): string => {
    return artifactImages.value[name] ?? ''
  }

  const getIcon = (key: string): string => {
    return icons.value[key] ?? ''
  }

  return {
    // State (readonly)
    characters: readonly(characters),
    artifacts: readonly(artifacts),
    pickerArtifacts,
    phantimals: readonly(phantimals),
    characterImages: readonly(characterImages),
    artifactImages: readonly(artifactImages),
    icons: readonly(icons),
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
    hasSeasonalTargeting: UNIT_LOOKUPS.seasonalTargeting,
    getCharacterFaction: UNIT_LOOKUPS.factionOf,
    getCharacterClass: UNIT_LOOKUPS.classOf,
    getCharacterImage,
    getOutfitImage,
    getArtifactImage,
    getIcon,

    // Expose for other stores
    characterRanges: readonly(characterRanges),
  }
})
