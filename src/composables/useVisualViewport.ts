import { onUnmounted, ref, watch, type Ref } from 'vue'

/* The part of the layout viewport the user can see (window.visualViewport). On a
 * phone the on-screen keyboard covers the bottom of the page without resizing
 * the layout viewport, and iOS may pan the view to keep the focused field in
 * sight, so a full-screen layer sized to the layout viewport loses its bottom
 * behind the keyboard. Tracked only while `active`; the height is null otherwise
 * or where the browser has no visual viewport. */
export function useVisualViewport(active: Ref<boolean>): {
  height: Ref<number | null>
  offsetTop: Ref<number>
} {
  const height = ref<number | null>(null)
  const offsetTop = ref(0)

  const read = (): void => {
    const view = window.visualViewport
    if (!view) return
    height.value = view.height
    offsetTop.value = view.offsetTop
  }

  const stop = (): void => {
    window.visualViewport?.removeEventListener('resize', read)
    window.visualViewport?.removeEventListener('scroll', read)
    height.value = null
    offsetTop.value = 0
  }

  if (import.meta.env.SSR) return { height, offsetTop }

  watch(
    active,
    (on) => {
      const view = window.visualViewport
      if (!view) return
      if (!on) {
        stop()
        return
      }
      read()
      view.addEventListener('resize', read)
      view.addEventListener('scroll', read)
    },
    { immediate: true },
  )
  onUnmounted(stop)

  return { height, offsetTop }
}
