import { ref, type Ref } from 'vue'

import { useBreakpoint } from '@/composables/useBreakpoint'
import { useGrids } from '@/stores/grids'
import type { DisplayFlags } from '@/utils/gridStateSerializer'

/**
 * Grid display state shared by the Arena and 5 v 5 views: the toggle flags
 * (serialized together as DisplayFlags for the share link + autosave) plus the
 * breakpoint-driven perspective. teamView/inverted are read from the grids store
 * (their single source of truth); the 5 v 5-only `wrap` is passed in. The owned
 * breakpoint is re-exposed so callers needing responsive sizing share one
 * matchMedia instance rather than spinning up a second.
 */
export function useDisplayFlags(opts: { wrap?: Ref<boolean> } = {}) {
  const { wrap } = opts
  const grids = useGrids()
  const { currentBreakpoint, showPerspective } = useBreakpoint()

  const showGridInfo = ref(true)
  const showSkills = ref(true)

  const toFlags = (): DisplayFlags => ({
    showGridInfo: showGridInfo.value,
    showPerspective: showPerspective.value,
    showSkills: showSkills.value,
    teamView: grids.teamView,
    inverted: grids.inverted,
    ...(wrap ? { wrap: wrap.value } : {}),
  })

  const applyFlags = (flags: DisplayFlags): void => {
    showGridInfo.value = flags.showGridInfo ?? true
    showPerspective.value = flags.showPerspective ?? false
    showSkills.value = flags.showSkills ?? true
    grids.teamView = flags.teamView ?? false
    grids.inverted = flags.inverted ?? false
    if (wrap) wrap.value = flags.wrap ?? false
  }

  return {
    showGridInfo,
    showSkills,
    showPerspective,
    currentBreakpoint,
    toFlags,
    applyFlags,
  }
}
