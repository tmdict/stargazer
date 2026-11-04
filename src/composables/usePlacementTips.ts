/* Placement tips on one board of the Arena or Teams: the PvP team generator's
 * card on why a unit stands where it does, for the ally unit hovered, dragged
 * or lifted, or the ally artifact hovered. The side is explained as it stands
 * by the Supreme League worker (sideExplanation), which starts with the first
 * card and answers again after each change to the side. */

import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'

import { getCharacterTeam } from '@/lib/characters/character'
import { artifactHostHex } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { configTiles, gridLayout } from '@/lib/maps'
import {
  cardRings,
  hasCard,
  type PlacementExplanation,
  type PlacementReason,
} from '@/lib/placement/explain'
import type { SlUnit } from '@/lib/pvp/sl/data/types'
import { Team } from '@/lib/types/team'
import { svgPointToScreen } from '@/utils/gridScreenPosition'
import { useDragDrop } from './useDragDrop'
import { useGridContext } from './useGridContext'
import type { GridEventAPI } from './useGridEvents'
import { useSelectionState } from './useSelectionState'
import { useSlEngine } from './useSlEngine'
import { useTouchDetection } from './useTouchDetection'

export interface PlacementTip {
  reasons: readonly PlacementReason[]
  alsoFine: readonly number[]
  better: readonly number[]
  // The tiles ringed in blue (the card's unit) and in amber (the units it
  // names), and how the ally artifact is ringed.
  own: ReadonlySet<number>
  named: ReadonlySet<number>
  artifact?: 'own' | 'named'
}

// `gridEvents` is the board's own bus, which its manager provides, and
// `liftActions` the lifted unit's Skills button.
export function usePlacementTips(
  gridEvents: GridEventAPI,
  enabled: () => boolean,
  svgEl: () => SVGSVGElement | null | undefined,
  liftActions: () => HTMLElement | null | undefined,
) {
  const ctx = useGridContext()
  const { isDragging, draggedCharacter } = useDragDrop()
  const { liftedHexId, liftedGridId } = useSelectionState()
  const { isTouchDevice } = useTouchDetection()
  const { explain } = useSlEngine({ startOnMount: false })

  const hovered = ref<number | 'artifact' | null>(null)
  const enter = (hexId: number): void => {
    hovered.value = hexId
  }
  const leave = (hexId: number): void => {
    if (hovered.value === hexId) hovered.value = null
  }
  const enterArtifact = (team: Team): void => {
    if (team === Team.ALLY) hovered.value = 'artifact'
  }
  const leaveArtifact = (): void => {
    if (hovered.value === 'artifact') hovered.value = null
  }
  gridEvents.on('character:mouseenter', enter)
  gridEvents.on('character:mouseleave', leave)
  gridEvents.on('artifact:mouseenter', enterArtifact)
  gridEvents.on('artifact:mouseleave', leaveArtifact)
  onScopeDispose(() => {
    gridEvents.off('character:mouseenter', enter)
    gridEvents.off('character:mouseleave', leave)
    gridEvents.off('artifact:mouseenter', enterArtifact)
    gridEvents.off('artifact:mouseleave', leaveArtifact)
  })
  // A drag fires no mouseleave on the unit it starts from.
  watch(isDragging, (dragging) => {
    if (dragging) hovered.value = null
  })

  const isAlly = (hexId: number): boolean => getCharacterTeam(ctx.grid, hexId) === Team.ALLY

  // A unit in hand wins over the pointer, so the card shows where to put it
  // down. Touch has no hover, only the lift.
  const subject = computed((): number | 'artifact' | null => {
    if (!enabled()) return null
    if (isDragging.value) {
      const from = draggedCharacter.value
      return from?.sourceGridId === ctx.id &&
        from.sourceHexId !== undefined &&
        isAlly(from.sourceHexId)
        ? from.sourceHexId
        : null
    }
    if (liftedHexId.value !== null && liftedGridId.value === ctx.id) {
      return isAlly(liftedHexId.value) ? liftedHexId.value : null
    }
    const at = hovered.value
    if (at === null || isTouchDevice.value) return null
    return at === 'artifact' || isAlly(at) ? at : null
  })

  const layout = computed(() => gridLayout(ctx.grid))
  const units = computed((): SlUnit[] =>
    [...ctx.placements]
      .filter(([hexId]) => isAlly(hexId))
      .map(([hexId, unit]): SlUnit => [hexId, unit])
      .sort(([a], [b]) => a - b),
  )
  const sideKey = computed(
    () => `${layout.value.key}|${ctx.artifacts.ally}|${units.value.join(';')}`,
  )

  // The answer for the side as it stood when asked, kept until the side changes.
  const answer = shallowRef<{ key: string; why: PlacementExplanation | null } | null>(null)
  let asked: string | null = null
  watch(
    () => (subject.value === null ? null : sideKey.value),
    async (key) => {
      if (key === null || key === answer.value?.key || key === asked) return
      asked = key
      let why: PlacementExplanation | null = null
      try {
        why = await explain(layout.value, units.value, ctx.artifacts.ally)
      } catch {
        why = null
      }
      if (asked !== key) return
      asked = null
      answer.value = { key, why }
    },
  )

  const card = computed((): PlacementTip | null => {
    const at = subject.value
    const why = answer.value?.key === sideKey.value ? answer.value.why : null
    if (at === null || !why) return null
    if (at === 'artifact') {
      return why.artifact.length
        ? { reasons: why.artifact, alsoFine: [], better: [], ...cardRings(why, why.artifact) }
        : null
    }
    const entry = why.units.find((unit) => unit.tile === at)
    if (!entry || !hasCard(entry)) return null
    const { reasons, alsoFine, better } = entry
    return { reasons, alsoFine, better, ...cardRings(why, reasons, entry.unit) }
  })

  // The side's other units, and its artifact, fade while a card shows.
  const faded = computed((): ReadonlySet<number> | null => {
    const shown = card.value
    if (!shown) return null
    return new Set(
      units.value
        .map(([hexId]) => hexId)
        .filter((hexId) => !shown.own.has(hexId) && !shown.named.has(hexId)),
    )
  })

  const screenBox = (hexes: readonly Hex[]): DOMRect | null => {
    const svg = svgEl()
    const points = hexes.flatMap((hex) =>
      ctx.layout.polygonCorners(hex).map((corner) => svgPointToScreen(corner, svg)),
    )
    if (!points.length || points.some((point) => !point)) return null
    const xs = points.map((point) => point!.x)
    const ys = points.map((point) => point!.y)
    const [left, top] = [Math.min(...xs), Math.min(...ys)]
    return new DOMRect(left, top, Math.max(...xs) - left, Math.max(...ys) - top)
  }

  // Over its unit and above the ally tiles and the lifted unit's Skills button,
  // so the card covers none of the tiles it rings or outlines; with no room
  // above, under them.
  const anchor = computed(() => {
    const at = subject.value
    if (!card.value || at === null) return null
    const own = at === 'artifact' ? artifactHostHex(ctx.grid, Team.ALLY) : ctx.grid.getHexById(at)
    const allies = [...configTiles(layout.value.config, Team.ALLY)].map((hexId) =>
      ctx.grid.getHexById(hexId),
    )
    return {
      getBoundingClientRect: (): DOMRect => {
        const unit = screenBox([own]) ?? new DOMRect()
        const zone = screenBox(allies) ?? unit
        const button = liftActions()?.getBoundingClientRect()
        const top = Math.min(zone.top, button?.top ?? zone.top)
        const bottom = Math.max(zone.bottom, button?.bottom ?? zone.bottom)
        return new DOMRect(unit.x, top, unit.width, bottom - top)
      },
    }
  })

  return { card, faded, anchor }
}
