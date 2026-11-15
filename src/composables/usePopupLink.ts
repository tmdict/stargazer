import { watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/* `?popup=<name>` opens that popup on any page, and an open popup shows its
 * name in the address, so the address bar is the link to share. Only the exact
 * names below open anything; another value, or `popup` given twice, is
 * ignored. */

const POPUP_NAMES = ['about', 'data', 'contact', 'whatsNew'] as const
type PopupName = (typeof POPUP_NAMES)[number]

interface LinkedPopup {
  shown: Ref<boolean>
  open: () => void
}

export function usePopupLink(popups: Record<PopupName, LinkedPopup>, ready: Ref<boolean>): void {
  const route = useRoute()
  const router = useRouter()

  // A link inside a popup closes it as the page changes. Rewriting the address
  // then would start a second navigation and cancel the link's, so the address
  // follows a popup only while no navigation is under way.
  let navigating = false
  router.beforeEach(() => {
    navigating = true
  })
  router.afterEach(() => {
    navigating = false
  })
  router.onError(() => {
    navigating = false
  })

  const linked = (): PopupName | null => {
    const value = route.query.popup
    return POPUP_NAMES.find((name) => name === value) ?? null
  }

  // The baked page has no query, so the address is read once the first route
  // has settled.
  watch([ready, linked], ([settled, name]) => {
    if (settled && name && !popups[name].shown.value) popups[name].open()
  })

  const syncAddress = (): void => {
    if (!ready.value || navigating) return
    const open = POPUP_NAMES.find((name) => popups[name].shown.value) ?? null
    if (open === linked()) return
    const query = { ...route.query }
    if (open) query.popup = open
    else delete query.popup
    // Replaced, so opening and closing a popup adds no step for Back.
    void router.replace({ query, hash: route.hash })
  }

  // Deferred to the next task, by which time a link's navigation has passed the
  // guard above.
  watch(
    () => POPUP_NAMES.map((name) => popups[name].shown.value),
    () => setTimeout(syncAddress),
  )
}
