import { ref, watch, type Ref } from 'vue'
import { useRouter, type Router } from 'vue-router'

/* `?popup=<name>` opens that popup on any page, and an open popup shows its
 * name in the address, so the address bar is the link to share. Only the exact
 * names below open anything; another value, or `popup` given twice, is
 * ignored.
 *
 * The name stays out of the router's location. A guard takes it off the
 * navigation that brings it, and the address bar gets it through
 * history.replaceState, which no route watcher, scroll rule or pending
 * navigation sees. Before the router adds a page to the history it writes the
 * page being left back to its own address, so Back never lands on a popup,
 * and a link to the page already open stays a no-op. */

const POPUP_NAMES = ['about', 'data', 'contact', 'whatsNew'] as const
type PopupName = (typeof POPUP_NAMES)[number]

// The name from the last navigation that brought one, once its page is shown.
const linked = ref<PopupName | null>(null)

export function installPopupLinkGuard(router: Router): void {
  let taken: PopupName | undefined
  router.beforeEach((to) => {
    const name = POPUP_NAMES.find((popup) => popup === to.query.popup)
    if (!name) return
    taken = name
    const query = { ...to.query }
    delete query.popup
    // Replaced: Back or Forward onto an entry that kept a name in its address
    // must not add an entry.
    return { path: to.path, query, hash: to.hash, replace: true }
  })
  router.afterEach((_to, _from, failure) => {
    if (taken && !failure) linked.value = taken
    taken = undefined
  })
}

interface LinkedPopup {
  shown: Ref<boolean>
  open: () => void
}

export function usePopupLink(popups: Record<PopupName, LinkedPopup>, ready: Ref<boolean>): void {
  const router = useRouter()

  // After the page change has closed what it closes, or the popup would open
  // and close at once.
  watch(
    [ready, linked],
    ([settled, name]) => {
      if (!settled || !name) return
      linked.value = null
      popups[name].open()
    },
    { flush: 'post' },
  )

  const showInAddress = (): void => {
    const open = POPUP_NAMES.find((name) => popups[name].shown.value)
    const { path, query, hash } = router.currentRoute.value
    const { href } = router.resolve({ path, query: open ? { ...query, popup: open } : query, hash })
    // history.state is the router's own record of the entry.
    if (href !== location.pathname + location.search + location.hash) {
      history.replaceState(history.state, '', href)
    }
  }

  // A navigation writes the router's address, so a popup left open puts its
  // name back.
  watch(
    () => [
      ready.value,
      router.currentRoute.value.fullPath,
      ...POPUP_NAMES.map((name) => popups[name].shown.value),
    ],
    () => {
      if (ready.value) showInAddress()
    },
    { flush: 'post' },
  )
}
