import { ref, onMounted, onUnmounted } from 'vue'
import type { Breakpoint } from '../stores/grid'
import { useGridStore } from '../stores/grid'

// Breakpoint thresholds
const MOBILE_BREAKPOINT = 480
const TABLET_BREAKPOINT = 768

export function useBreakpoint(options: { autoFlattenOnMobile?: boolean } = {}) {
  const gridStore = useGridStore()
  const { autoFlattenOnMobile = true } = options

  // Track current breakpoint
  const currentBreakpoint = ref<Breakpoint>('desktop')
  const showPerspective = ref(true)

  // Determine breakpoint from window width
  const getBreakpoint = (width: number): Breakpoint => {
    if (width <= MOBILE_BREAKPOINT) return 'mobile'
    if (width <= TABLET_BREAKPOINT) return 'tablet'
    return 'desktop'
  }

  // Handle window resize
  const handleResize = () => {
    const newBreakpoint = getBreakpoint(window.innerWidth)

    // Only update if breakpoint actually changed
    if (newBreakpoint !== currentBreakpoint.value) {
      const previousBreakpoint = currentBreakpoint.value
      currentBreakpoint.value = newBreakpoint
      gridStore.updateBreakpoint(newBreakpoint)

      // Automatically enable flat view (disable perspective) when moving to mobile (if enabled)
      if (autoFlattenOnMobile && newBreakpoint === 'mobile' && previousBreakpoint !== 'mobile') {
        showPerspective.value = false
      }
    }
  }

  // Initialize and setup listeners
  const setupBreakpoint = () => {
    // Initial setup
    currentBreakpoint.value = getBreakpoint(window.innerWidth)
    gridStore.updateBreakpoint(currentBreakpoint.value)

    // If starting on mobile, automatically enable flat view (if enabled)
    if (autoFlattenOnMobile && currentBreakpoint.value === 'mobile') {
      showPerspective.value = false
    }

    // Add resize listener
    window.addEventListener('resize', handleResize)

    // Handle orientation change
    window.addEventListener('orientationchange', handleResize)
  }

  // Cleanup listeners
  const cleanupBreakpoint = () => {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', handleResize)
  }

  // Auto-setup and cleanup if used in component context
  onMounted(() => {
    setupBreakpoint()
  })

  onUnmounted(() => {
    cleanupBreakpoint()
  })

  return {
    currentBreakpoint,
    showPerspective,
    getBreakpoint,
    handleResize,
    setupBreakpoint,
    cleanupBreakpoint,
    MOBILE_BREAKPOINT,
    TABLET_BREAKPOINT,
  }
}
