import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'

import { SkillManager } from '../lib/skill'
import type { Team } from '../lib/types/team'

export const useSkillStore = defineStore('skill', () => {
  // Create reactive skill manager instance
  const skillManager = reactive(new SkillManager())

  // Computed color modifiers from skill manager
  const colorModifiersByCharacterAndTeam = computed(() => {
    return skillManager.getColorModifiersByCharacterAndTeam()
  })

  // Helper to get color modifier for a character on a specific hex
  const getColorModifierForHex = (
    hexId: number,
    characterId: number,
    team: Team,
  ): string | undefined => {
    const key = `${characterId}-${team}`
    const color = colorModifiersByCharacterAndTeam.value.get(key)
    return color
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
    getColorModifierForHex,
    getAllSkillTargets,
    getActiveSkillInfo,

    // Internal use by character store
    _getSkillManager: () => skillManager as SkillManager,
  }
})
