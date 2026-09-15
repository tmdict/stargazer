import { useToast } from '@/composables/useToast'
import { useI18nStore } from '@/stores/i18n'
import { useTeamLibrary } from '@/stores/teamLibrary'

// Outcome toasts for saved-team mutations. The store applies a mutation in
// memory even when its write fails, so a success message is shown only once
// the write landed; otherwise the loss is reported in its place.
export function useTeamLibraryFeedback() {
  const library = useTeamLibrary()
  const i18n = useI18nStore()
  const { success, error } = useToast()

  const report = (message?: string): void => {
    if (!library.persisted) error(i18n.t('app.team-not-stored'))
    else if (message) success(message)
  }

  return { report }
}
