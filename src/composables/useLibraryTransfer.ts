import { ref } from 'vue'

import { useToast } from '@/composables/useToast'
import type { ImportOutcome } from '@/lib/exportFile'
import { useI18nStore } from '@/stores/i18n'
import { downloadBlob, timestampedName } from '@/utils/download'

/* Backup-file buttons for a user library (saved teams, rosters): the download
 * and the hidden file input's import, with the outcome toasts. Bind `fileInput`
 * to an `<input type="file">` whose change runs `handleFileChosen`.
 *
 * `report` is the library's success reporter: the store applies an import in
 * memory even when its write fails, so it shows the storage error in place of
 * the success message. The message keys take `imported` and `skipped`, and
 * the conflicts one also `conflicts` (records renamed "(imported)"). */
export function useLibraryTransfer({
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
  const fileInput = ref<HTMLInputElement>()

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

  return { fileInput, download, handleFileChosen }
}
