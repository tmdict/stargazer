/* Single-board skill queries over the active grid context.
 *
 * Adapts the active board's SkillManager in useGrids to the skill API the grid
 * components consume. Each board owns its own SkillManager, so these queries
 * reflect whichever board is active.
 */

import { computed } from 'vue'
import { defineStore } from 'pinia'

import type { SkillManager } from '@/lib/skills/skill'
import { useGrids } from './grids'

export const useSkillStore = defineStore('skill', () => {
  const grids = useGrids()
  const skillManager = (): SkillManager => grids.active!.skillManager

  const getAllSkillTargets = computed(() => {
    // Access version to trigger reactivity when targets change
    skillManager().getTargetVersion()
    return skillManager().getAllSkillTargets()
  })

  return {
    getAllSkillTargets,
  }
})
