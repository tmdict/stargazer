/* The move from the old address, as the app sees it: taking a hand-over's link
 * code at start-up, and the banner and popup that explain the move. Goes with
 * lib/move when recovery retires. */

import { onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import type { Pinia } from 'pinia'

import {
  HAND_OVER_FAILED,
  LINK_MARK,
  MOVE_STAGE,
  OLD_HOST,
  RECOVERY_URL,
  REQUEST_KEY,
  REQUEST_WINDOW_MS,
  type HandOverResult,
} from '@/lib/move/config'
import { readFlag, writeFlag } from '@/utils/flags'
import { readPrefs } from '@/utils/prefs'
import { storageReadable } from '@/utils/storage'

/* The router reads the address as it is created, so the code leaves the
 * address bar while this module loads: the entry file imports the app, and
 * this module with it, ahead of the router. The code then cannot reach a
 * bookmark or a shared link either. */
const takeArrivalCode = (): string | null => {
  if (import.meta.env.SSR || typeof location === 'undefined') return null
  if (!location.hash.startsWith(LINK_MARK)) return null
  const code = location.hash.slice(LINK_MARK.length)
  history.replaceState(history.state, '', location.pathname + location.search)
  return code
}

const arrivalCode = takeArrivalCode()

// Whether this tab asked the old address for its data a moment ago, which is
// what tells a requested hand-over from a link that was reopened or pasted.
const takeRequest = (): boolean => {
  try {
    const asked = Number(sessionStorage.getItem(REQUEST_KEY))
    sessionStorage.removeItem(REQUEST_KEY)
    const age = Date.now() - asked
    return asked > 0 && age >= 0 && age < REQUEST_WINDOW_MS
  } catch {
    return false
  }
}

const result = shallowRef<HandOverResult | null>(null)
// Whether the visitor asked for the hand-over that arrived, with the popup's button.
const resultRequested = ref(false)
const bannerShown = ref(false)
const popupShown = ref(false)
// Whether the popup is the one that opened by itself as a hand-over arrived.
const popupOnArrival = ref(false)

/** Applies an arriving hand-over. The app waits for it before reading saved data. */
export async function startMove(pinia: Pinia): Promise<void> {
  if (import.meta.env.SSR) return
  // The head script is packing this address's data and about to leave. The app
  // must not start meanwhile: it would write to the storage being carried.
  if (MOVE_STAGE === 1 && location.hostname === OLD_HOST) await new Promise(() => {})
  // Taken even when no code came back, so a request the old address could not
  // answer does not vouch for a later link.
  const requested = takeRequest()
  if (arrivalCode === null) return
  resultRequested.value = requested
  try {
    const { applyHandOver } = await import('@/lib/move/receive')
    result.value = await applyHandOver(arrivalCode, requested, pinia)
  } catch {
    result.value = HAND_OVER_FAILED
  }
  // The head script set the look before the carried choice was here.
  const theme = readPrefs()?.theme
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

/** Sends the visitor to the old address to fetch its data, and back to this page. */
function bringOldData(): void {
  try {
    sessionStorage.setItem(REQUEST_KEY, String(Date.now()))
  } catch {
    // Without the marker the arrival still applies in a browser that has not
    // received a hand-over.
  }
  const page = location.pathname + location.search
  location.assign(`${RECOVERY_URL}?bring=${encodeURIComponent(page)}`)
}

export function useMove() {
  const router = useRouter()

  // After mount, so the first render matches the pre-rendered page.
  onMounted(() => {
    bannerShown.value = true
    popupOnArrival.value = result.value !== null
    // A browser's first landing opens the popup once, `welcomed` being the
    // date it did. One that a hand-over reached has had its popup, and one
    // that refuses its storage would be asked on every visit.
    const firstLanding =
      storageReadable() && readFlag('welcomed') === null && readFlag('moved') === null
    popupShown.value = popupOnArrival.value || firstLanding
    if (popupShown.value && readFlag('welcomed') === null) writeFlag('welcomed')
  })

  // The popup must not stay open over another page. The app mounts before its
  // first route resolves, and that first resolve is not a change of page.
  router.afterEach((to, from) => {
    if (!from.matched.length || to.path === from.path) return
    popupShown.value = false
  })

  const openPopup = () => {
    popupOnArrival.value = false
    popupShown.value = true
  }

  return {
    result,
    resultRequested,
    bannerShown,
    popupShown,
    popupOnArrival,
    openPopup,
    bringOldData,
  }
}
