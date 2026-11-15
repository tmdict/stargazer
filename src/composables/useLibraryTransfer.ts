import { useRosterFeedback } from '@/composables/useRosterFeedback'
import { useTeamLibraryFeedback } from '@/composables/useTeamLibraryFeedback'
import { useToast } from '@/composables/useToast'
import type { ImportOutcome } from '@/lib/exportFile'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { downloadBlob, timestampedName } from '@/utils/download'

/* A user library's backup file (saved teams, rosters): the download, and the
 * import of a file input's chosen file, with the outcome toasts.
 *
 * `report` is the library's success reporter: the store applies an import in
 * memory even when its write fails, so it shows the storage error in place of
 * the success message. The message keys take `imported` and `skipped`, and
 * the conflicts one also `conflicts` (records renamed "(imported)"). */
function useLibraryTransfer({
  filePrefix,
  importFile,
  report,
  messages,
}: {
  filePrefix: string
  importFile: (raw: string) => ImportOutcome
  report: (message: string) => void
  messages: { invalid: string; success: string; successConflicts: string }
}) {
  const i18n = useI18nStore()
  const { error } = useToast()

  const download = (file: object): void => {
    downloadBlob(
      new Blob([JSON.stringify(file)], { type: 'application/json' }),
      timestampedName(filePrefix, 'json'),
    )
  }

  const handleFileChosen = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // allow re-importing the same file
    if (!file) return
    const { imported, skipped, conflicts, invalid } = importFile(await file.text())
    if (invalid) {
      error(i18n.t(messages.invalid))
      return
    }
    report(
      conflicts > 0
        ? i18n.t(messages.successConflicts, { imported, skipped, conflicts })
        : i18n.t(messages.success, { imported, skipped }),
    )
  }

  return { download, handleFileChosen }
}

export function useTeamsTransfer() {
  const library = useTeamLibrary()
  const { report } = useTeamLibraryFeedback()
  return useLibraryTransfer({
    filePrefix: 'stargazer-teams',
    importFile: library.importTeams,
    report,
    messages: {
      invalid: 'app.import-invalid',
      success: 'app.import-success',
      successConflicts: 'app.import-success-conflicts',
    },
  })
}

export function useRostersTransfer({ activate = true } = {}) {
  const rosters = useRosters()
  const { report } = useRosterFeedback()
  return useLibraryTransfer({
    filePrefix: 'stargazer-rosters',
    importFile: (raw) => rosters.importRosters(raw, { activate }),
    report,
    messages: {
      invalid: 'app.rosters-import-invalid',
      success: 'app.rosters-import-success',
      successConflicts: 'app.rosters-import-success-conflicts',
    },
  })
}
