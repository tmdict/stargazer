import { nextTick, onUnmounted, ref, watch, type Ref } from 'vue'

import { clampX, VIEWPORT_MARGIN } from '@/utils/viewport'

type PanelAlign = 'center' | 'left' | 'right'

const alignedLeft = (trigger: DOMRect, width: number, align: PanelAlign): number => {
  if (align === 'left') return trigger.left
  if (align === 'right') return trigger.right - width
  return trigger.left + trigger.width / 2 - width / 2
}

/* Horizontal nudge for a dropdown panel centred under its trigger (or, with
 * `align: 'left'` or `'right'`, lined up with that edge of it): while `active`,
 * the returned shift (px, bind as `--panel-shift`) keeps the panel inside the
 * viewport when the trigger sits near an edge. It resets on close, or a stale
 * shift would flash for one frame on the next open if the trigger moved while
 * closed. */
export function usePanelClamp(
  triggerRef: Ref<HTMLElement | undefined>,
  panelRef: Ref<HTMLElement | undefined>,
  active: () => boolean,
  align: () => PanelAlign = () => 'center',
): Ref<number> {
  const shift = ref(0)

  const clamp = (): void => {
    const panel = panelRef.value
    const trigger = triggerRef.value
    if (!panel || !trigger) return
    const left = alignedLeft(trigger.getBoundingClientRect(), panel.offsetWidth, align())
    shift.value = clampX(left, panel.offsetWidth, VIEWPORT_MARGIN) - left
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
