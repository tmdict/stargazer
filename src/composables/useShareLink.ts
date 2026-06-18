import { useRouter } from 'vue-router'

import { useI18nStore } from '@/stores/i18n'
import { useToast } from './useToast'

/* Copies a read-only /share link for an already-encoded grid state and opens the
 * share page. The `linkCopied` history state tells ShareView to show the "copied"
 * toast on arrival, so the toast fires once, on the share page, for both the Arena
 * and the 5 v 5 boards. */
export function useShareLink() {
  const router = useRouter()
  const i18n = useI18nStore()
  const { error } = useToast()

  return async function shareEncodedState(encodedState: string): Promise<void> {
    try {
      const shareLink = `${window.location.origin}/share?g=${encodedState}`
      await navigator.clipboard.writeText(shareLink)
      router.push({ path: '/share', query: { g: encodedState }, state: { linkCopied: true } })
    } catch (err) {
      console.error('Failed to copy share link:', err)
      error(i18n.t('app.copy-link-failed'))
    }
  }
}
