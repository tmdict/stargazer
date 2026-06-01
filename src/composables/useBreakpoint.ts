import { onMounted, onUnmounted, ref } from 'vue'

import type { Breakpoint } from '@/stores/grid'
import { useGridStore } from '@/stores/grid'
import { MOBILE_MAX_WIDTH, TABLET_MAX_WIDTH } from '@/utils/breakpoints'

export function useBreakpoint(options: { autoFlattenOnMobile?: boolean } = {}) {
  const gridStore = useGridStore()
  const { autoFlattenOnMobile = true } = options

  const currentBreakpoint = ref<Breakpoint>('desktop')
  const showPerspective = ref(false)

  // matchMedia (not window.innerWidth) drives the breakpoint: it reflects the
  // live viewport even when innerWidth lags (e.g. DevTools emulation), and its
  // change events fire exactly on threshold crossings — no resize-timing race.
  let mqMobile: MediaQueryList | null = null
  let mqTablet: MediaQueryList | null = null

  const read = (): Breakpoint => {
    if (mqMobile?.matches) return 'mobile'
    if (mqTablet?.matches) return 'tablet'
    return 'desktop'
  }

  const apply = () => {
    const next = read()
    if (next === currentBreakpoint.value) return
    const previous = currentBreakpoint.value
    currentBreakpoint.value = next
    gridStore.updateBreakpoint(next)
    // Flatten (disable perspective) when entering mobile.
    if (autoFlattenOnMobile && next === 'mobile' && previous !== 'mobile') {
      showPerspective.value = false
    }
  }

  onMounted(() => {
    mqMobile = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`)
    mqTablet = window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`)

    // Initial sync — currentBreakpoint starts at 'desktop', so apply directly.
    currentBreakpoint.value = read()
    gridStore.updateBreakpoint(currentBreakpoint.value)
    if (autoFlattenOnMobile && currentBreakpoint.value === 'mobile') showPerspective.value = false

    mqMobile.addEventListener('change', apply)
    mqTablet.addEventListener('change', apply)
  })

  onUnmounted(() => {
    mqMobile?.removeEventListener('change', apply)
    mqTablet?.removeEventListener('change', apply)
  })

  return {
    currentBreakpoint,
    showPerspective,
  }
}
