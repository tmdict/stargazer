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

  return {
    colorModifiersByCharacterAndTeam,
    getColorModifierForHex,

    // Internal use by character store
    _getSkillManager: () => skillManager as SkillManager,
  }
})
