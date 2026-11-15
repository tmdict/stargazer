import { useHoverTooltip } from './useHoverTooltip'
import { useInspect, type InspectTarget } from './useInspect'
import { useLongPress } from './useLongPress'

/* Inspect wiring for an icon that cannot go on a board: with nothing else for
 * a click to do, it opens the details as a right-click or a hold does, and the
 * hover card closes first so it is not left over the popup. */
export function useInspectOnClick(target: () => InspectTarget) {
  const { showTooltip, onMouseEnter, onMouseLeave } = useHoverTooltip()
  const { inspect } = useInspect()

  const open = (): void => {
    showTooltip.value = false
    void inspect(target())
  }
  const { pressing, start, onContextMenu } = useLongPress<true>(open, { releaseOpens: true })

  return {
    showTooltip,
    onMouseEnter,
    onMouseLeave,
    open,
    pressing,
    onPointerDown: (event: PointerEvent) => start(event, true),
    onContextMenu: (event: MouseEvent) => onContextMenu(event, true),
  }
}
