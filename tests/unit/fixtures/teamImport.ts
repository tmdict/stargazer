import { effectScope, type EffectScope } from 'vue'

import { useTeamImport } from '@/composables/useTeamImport'

// The team import as its modal holds it, inside a scope; leaving the page
// unmounts the modal, which `leaveTeamImport` stands in for, and drops its
// shots and the import engine.
let scope: EffectScope | null = null

export const holdTeamImport = (
  ...args: Parameters<typeof useTeamImport>
): ReturnType<typeof useTeamImport> => {
  scope ??= effectScope()
  return scope.run(() => useTeamImport(...args))!
}

export const leaveTeamImport = (): void => {
  scope?.stop()
  scope = null
}
