import { computed, reactive } from 'vue'
import { defineStore } from 'pinia'

import { SkillManager } from '@/lib/skills/skill'
import type { Team } from '@/lib/types/team'

export const useSkillStore = defineStore('skill', () => {
  // Create reactive skill manager instance
  const skillManager = reactive(new SkillManager())

  // Computed color modifiers from skill manager
  const colorModifiersByCharacterAndTeam = computed(() => {
    return skillManager.getColorModifiersByCharacterAndTeam()
  })

  // Computed image modifiers from skill manager
  const imageModifiersByCharacterAndTeam = computed(() => {
    return skillManager.getImageModifiersByCharacterAndTeam()
  })

  // Computed tile color modifiers from skill manager
  const tileColorModifiers = computed(() => {
    // Access version to trigger reactivity when modifiers change
    skillManager.getTargetVersion()
    return skillManager.getTileColorModifiers()
  })

  // Helper to get color modifier for a character
  const getColorModifierForCharacter = (characterId: number, team: Team): string | undefined => {
    const key = `${characterId}-${team}`
    const color = colorModifiersByCharacterAndTeam.value.get(key)
    return color
  }

  // Helper to get image modifier for a character
  const getImageModifierForCharacter = (characterId: number, team: Team): string | undefined => {
    const key = `${characterId}-${team}`
    const imageName = imageModifiersByCharacterAndTeam.value.get(key)
    return imageName
  }

  // Helper to get tile color modifiers for a specific hex
  const getTileColorModifier = (hexId: number): string[] | undefined => {
    return tileColorModifiers.value.get(hexId)
  }

  // Skill targeting methods - return as computed to ensure reactivity
  const getAllSkillTargets = computed(() => {
    // Access version to trigger reactivity when targets change
    skillManager.getTargetVersion()
    return skillManager.getAllSkillTargets()
  })

  // Get active skill info for a character
  const getActiveSkillInfo = (characterId: number, team?: Team) => {
    return skillManager.getActiveSkillInfo(characterId, team)
  }

  return {
    colorModifiersByCharacterAndTeam,
    imageModifiersByCharacterAndTeam,
    tileColorModifiers,
    getColorModifierForCharacter,
    getImageModifierForCharacter,
    getTileColorModifier,
    getAllSkillTargets,
    getActiveSkillInfo,

    // Internal use by character store
    _getSkillManager: () => skillManager as SkillManager,
  }
})
