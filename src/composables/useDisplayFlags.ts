import { ref, type Ref } from 'vue'

import { useBreakpoint } from '@/composables/useBreakpoint'
import { useGrids } from '@/stores/grids'
import type { DisplayFlags } from '@/utils/gridStateSerializer'

/**
 * Grid display state shared by the Arena and 5 v 5 views: the toggle flags
 * (serialized together as DisplayFlags for the share link + autosave) plus the
 * breakpoint-driven perspective. teamView/inverted/perspective live in the grids
 * store (their single source of truth), perspective reached through
 * useBreakpoint; the 5 v 5-only `wrap` is passed in. The owned
 * breakpoint is re-exposed so callers needing responsive sizing share one
 * matchMedia instance rather than spinning up a second.
 */
export function useDisplayFlags(opts: { wrap?: Ref<boolean> } = {}) {
  const { wrap } = opts
  const grids = useGrids()
  const { currentBreakpoint, showPerspective } = useBreakpoint()

  const showSkills = ref(false)

  const toFlags = (): DisplayFlags => ({
    showPerspective: showPerspective.value,
    showSkills: showSkills.value,
    teamView: grids.teamView,
    inverted: grids.inverted,
    ...(wrap ? { wrap: wrap.value } : {}),
  })

  const applyFlags = (flags: Required<DisplayFlags>): void => {
    showPerspective.value = flags.showPerspective
    showSkills.value = flags.showSkills
    grids.teamView = flags.teamView
    grids.inverted = flags.inverted
    if (wrap) wrap.value = flags.wrap
  }

  return {
    showSkills,
    showPerspective,
    currentBreakpoint,
    toFlags,
    applyFlags,
  }
}
