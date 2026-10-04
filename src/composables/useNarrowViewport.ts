import { onMounted, onUnmounted, ref, type Ref } from 'vue'

import { TABLET_MAX_WIDTH } from '@/utils/breakpoints'

/* Whether the viewport is within the tablet tier: the layouts where the side
 * panel is a bottom sheet. False until mounted: pre-rendered pages carry the
 * wide layout, so a read at setup would mismatch on a narrow screen. */
export function useNarrowViewport(): Ref<boolean> {
  const narrow = ref(false)
  const query = import.meta.env.SSR ? null : window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`)
  const sync = (): void => {
    narrow.value = query!.matches
  }
  onMounted(() => {
    if (!query) return
    sync()
    query.addEventListener('change', sync)
  })
  onUnmounted(() => query?.removeEventListener('change', sync))
  return narrow
}
