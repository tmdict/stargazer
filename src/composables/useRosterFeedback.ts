import { useToast } from '@/composables/useToast'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

// Outcome toasts for roster changes. The store applies a change in memory even
// when its write fails, so a success message is shown only once the write
// landed; otherwise the loss is reported in its place.
export function useRosterFeedback() {
  const rosters = useRosters()
  const i18n = useI18nStore()
  const { success, error } = useToast()

  const report = (message?: string): void => {
    if (!rosters.persisted) error(i18n.t('app.rosters-not-stored'))
    else if (message) success(message)
  }

  return { report }
}
