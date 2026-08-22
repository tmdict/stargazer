import { readonly, ref } from 'vue'
import { defineStore } from 'pinia'

import { isPhantimalId, toLocalPhantimalId } from '@/lib/characters/phantimal'
import { decomposeUnitId } from '@/lib/characters/synergy'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
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
    // Synergy-band ids mirror the base namespace: decompose first, or a synergy
    // main would take its own skill's companion branch (e.g. turret range).
    const { localId } = decomposeUnitId(characterId)
    if (localId >= COMPANION_ID_OFFSET) {
      const mainCharacterId = localId % COMPANION_ID_OFFSET
      const skill = getCharacterSkill(mainCharacterId)
      if (skill?.companionRange !== undefined) {
        return skill.companionRange
      }
      return characterRanges.value.get(mainCharacterId) ?? 1
    }
    return characterRanges.value.get(localId) ?? 1
  }

  const getCharacterById = (characterId: number): CharacterType | undefined => {
    return characters.value.find((char) => char.id === characterId)
  }

  const getCharacterNameById = (characterId: number): string | undefined => {
    if (isPhantimalId(characterId)) {
      return getPhantimalById(characterId)?.name
    }
    const { localId } = decomposeUnitId(characterId)
    const actualId = localId >= COMPANION_ID_OFFSET ? localId % COMPANION_ID_OFFSET : localId
    const character = getCharacterById(actualId)
    return character?.name
  }

  // Portrait image name for a unit id: a companion uses its skill's static
  // companion image when one is defined (e.g. Zanie's turret), otherwise its
  // main hero's portrait, matching what the live grid renders.
  const getCharacterImageNameById = (characterId: number): string | undefined => {
    const { localId } = decomposeUnitId(characterId)
    if (!isPhantimalId(characterId) && localId >= COMPANION_ID_OFFSET) {
      const custom = getCharacterSkill(localId % COMPANION_ID_OFFSET)?.companionImageModifier
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

  // Resolves a grid unit's faction by ID, mapping companions to their main
  // character and phantimals to their own faction.
  const getCharacterFaction = (characterId: number): string | undefined => {
    if (isPhantimalId(characterId)) return getPhantimalById(characterId)?.faction
    const { localId } = decomposeUnitId(characterId)
    const actualId = localId >= COMPANION_ID_OFFSET ? localId % COMPANION_ID_OFFSET : localId
    return getCharacterById(actualId)?.faction
  }

  // Resolves a grid unit's class by ID, mapping companions to their main
  // character. Phantimals carry no class.
  const getCharacterClass = (characterId: number): string | undefined => {
    if (isPhantimalId(characterId)) return undefined
    const { localId } = decomposeUnitId(characterId)
    const actualId = localId >= COMPANION_ID_OFFSET ? localId % COMPANION_ID_OFFSET : localId
    return getCharacterById(actualId)?.class
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
