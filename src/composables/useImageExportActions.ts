import { useI18nStore } from '@/stores/i18n'
import { copyImageBlob } from '@/utils/clipboard'
import { downloadBlob, timestampedName } from '@/utils/download'
import { useToast } from './useToast'

/* Shared copy/download wrappers for the image exporters (grid, card thumbnail,
 * stitcher): they own the user feedback and the Safari user-activation
 * contract, so every exporter hands over its capture as a pending promise and
 * stays inside the click. */
export function useImageExportActions() {
  const { success, error } = useToast()
  const i18n = useI18nStore()

  const copyImage = async (blob: Promise<Blob>): Promise<void> => {
    try {
      await copyImageBlob(blob)
      success(i18n.t('app.copied-clipboard'))
    } catch (err) {
      console.error('Failed to copy image:', err)
      error(i18n.t('app.copy-image-failed'))
    }
  }

  const downloadImage = async (
    blob: Promise<Blob>,
    filePrefix: string,
    successKey = 'app.image-downloaded',
  ): Promise<void> => {
    try {
      downloadBlob(await blob, timestampedName(filePrefix, 'png'))
      success(i18n.t(successKey))
    } catch (err) {
      console.error('Failed to download image:', err)
      error(i18n.t('app.download-failed'))
    }
  }

  return { copyImage, downloadImage }
}
