import { nextTick, onUnmounted, ref, watch, type Ref } from 'vue'

import { clampX } from '@/utils/viewport'

/* Horizontal nudge for a dropdown panel centred under its trigger (or, with
 * `align: 'left'`, starting at its left edge): while `active`, the returned
 * shift (px, bind as `--panel-shift`) keeps the panel inside the viewport when
 * the trigger sits near an edge. It resets on close, or a stale shift would
 * flash for one frame on the next open if the trigger moved while closed. */
export function usePanelClamp(
  triggerRef: Ref<HTMLElement | undefined>,
  panelRef: Ref<HTMLElement | undefined>,
  active: () => boolean,
  align: () => 'center' | 'left' = () => 'center',
): Ref<number> {
  const shift = ref(0)

  const clamp = (): void => {
    const panel = panelRef.value
    const trigger = triggerRef.value
    if (!panel || !trigger) return
    const rect = trigger.getBoundingClientRect()
    const left = align() === 'left' ? rect.left : rect.left + rect.width / 2 - panel.offsetWidth / 2
    shift.value = clampX(left, panel.offsetWidth, 8) - left
  }

  watch(active, async (on) => {
    if (on) {
      window.addEventListener('resize', clamp)
      await nextTick()
      clamp()
    } else {
      window.removeEventListener('resize', clamp)
      shift.value = 0
    }
  })
  onUnmounted(() => window.removeEventListener('resize', clamp))

  return shift
}
