/* Placing units on the tiles of an import review's screenshot, shared by the
 * replay frame and the formation shot. A click on a free tile places the
 * side's next unit there: the one chosen in its list, else the first of its
 * order without a tile. A click on a placed unit, or with nothing to place,
 * opens a picker of the side's units instead, and a tile number typed beside a
 * unit places it as a click does. Every pick goes out through `setPick`. */

import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'

import { SIDES } from '@/lib/teams/teamImport'
import type { Team } from '@/lib/types/team'

export interface PlacingSide {
  // The units placed in turn.
  order: readonly number[]
  // The heroes the picker names in its first row.
  heroes: readonly number[]
  // Every unit a pick may name.
  options: readonly number[]
  // The unit picked for each tile, by hex id.
  picks: ReadonlyMap<number, number>
}

export interface TilePicker {
  hexId: number
  side: Team
  // Where the tile is, as a fraction of the drawn board.
  left: number
  top: number
}

export interface PickerItem {
  unitId: number
  tile: number | null
}

export function useTilePlacing(config: {
  sides: () => Partial<Record<Team, PlacingSide>>
  // Why a typed tile cannot take a unit of the side, or null when it can;
  // the hex id is NaN for text that is not a number.
  refusal: (side: Team, hexId: number, text: string) => string | null
  setPick: (side: Team, hexId: number, unitId: number | null) => void
}): {
  nextUnits: ComputedRef<Partial<Record<Team, number | null>>>
  choose: (side: Team, unitId: number) => void
  clickTile: (target: TilePicker) => void
  hovered: Ref<{ side: Team; hexId: number } | null>
  preview: ComputedRef<{ side: Team; hexId: number; unitId: number } | null>
  picker: Ref<TilePicker | null>
  pickerItems: ComputedRef<{ heroes: PickerItem[]; extras: PickerItem[] }>
  pickedHere: ComputedRef<number | null>
  pick: (unitId: number | null) => void
  rows: (side: Team) => PickerItem[]
  typeError: Ref<string | null>
  typeTile: (side: Team, unitId: number, input: HTMLInputElement) => boolean
  typeTileAndNext: (
    side: Team,
    unitId: number,
    event: KeyboardEvent,
    boxes: HTMLInputElement[],
  ) => void
} {
  const sideOf = (side: Team): PlacingSide | undefined => config.sides()[side]

  const tileOf = (side: Team, unitId: number): number | null =>
    [...(sideOf(side)?.picks ?? [])].find(([, id]) => id === unitId)?.[0] ?? null

  // Per side, a unit chosen in the lists to place next, or null after the
  // reviewer stops placing; absent, the first unit of its order without a tile
  // goes next.
  const chosen = ref<Partial<Record<Team, number | null>>>({})

  const nextFor = (side: Team, placing: PlacingSide): number | null => {
    const choice = chosen.value[side]
    if (choice === null) return null
    if (choice !== undefined && placing.options.includes(choice)) return choice
    return placing.order.find((unitId) => tileOf(side, unitId) === null) ?? null
  }
  const nextUnits = computed(() => {
    const sides = config.sides()
    const next: Partial<Record<Team, number | null>> = {}
    for (const side of SIDES) {
      const placing = sides[side]
      if (placing) next[side] = nextFor(side, placing)
    }
    return next
  })

  // Choosing the unit already next stops placing, so tile clicks open the picker.
  const choose = (side: Team, unitId: number): void => {
    chosen.value = { ...chosen.value, [side]: nextUnits.value[side] === unitId ? null : unitId }
  }

  // Placing the chosen unit, however it is placed, uses the choice up, so the
  // order goes on from there.
  const place = (side: Team, hexId: number, unitId: number | null): void => {
    config.setPick(side, hexId, unitId)
    if (unitId !== null && chosen.value[side] === unitId) {
      chosen.value = { ...chosen.value, [side]: undefined }
    }
  }

  const picker = ref<TilePicker | null>(null)

  // Escape closes only the picker: heard on capture, before the modal's own
  // listener would close the import and drop every shot with it.
  const closeOnEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !picker.value) return
    event.stopPropagation()
    picker.value = null
  }
  onMounted(() => document.addEventListener('keydown', closeOnEscape, { capture: true }))
  onUnmounted(() => document.removeEventListener('keydown', closeOnEscape, { capture: true }))

  const clickTile = (target: TilePicker): void => {
    const free = !sideOf(target.side)?.picks.has(target.hexId)
    const next = free ? (nextUnits.value[target.side] ?? null) : null
    if (next === null) {
      picker.value = picker.value?.hexId === target.hexId ? null : target
      return
    }
    picker.value = null
    place(target.side, target.hexId, next)
  }

  const hovered = ref<{ side: Team; hexId: number } | null>(null)
  const preview = computed(() => {
    const tile = hovered.value
    if (!tile || picker.value || sideOf(tile.side)?.picks.has(tile.hexId)) return null
    const unitId = nextUnits.value[tile.side] ?? null
    return unitId === null ? null : { ...tile, unitId }
  })

  const pickerItems = computed(() => {
    const target = picker.value
    const placing = target ? sideOf(target.side) : undefined
    if (!target || !placing) return { heroes: [], extras: [] }
    const item = (unitId: number): PickerItem => ({ unitId, tile: tileOf(target.side, unitId) })
    return {
      heroes: placing.heroes.map(item),
      extras: placing.options.filter((unitId) => !placing.heroes.includes(unitId)).map(item),
    }
  })

  const pickedHere = computed(() => {
    const target = picker.value
    return target ? (sideOf(target.side)?.picks.get(target.hexId) ?? null) : null
  })

  const pick = (unitId: number | null): void => {
    const target = picker.value
    if (!target) return
    place(target.side, target.hexId, unitId)
    picker.value = null
  }

  // A side's list: its order, then the units picked outside it.
  const rows = (side: Team): PickerItem[] => {
    const placing = sideOf(side)
    if (!placing) return []
    const others = [...placing.picks]
      .filter(([, unitId]) => !placing.order.includes(unitId))
      .map(([tile, unitId]) => ({ unitId, tile }))
    return [...placing.order.map((unitId) => ({ unitId, tile: tileOf(side, unitId) })), ...others]
  }

  const typeError = ref<string | null>(null)

  // False when the typed tile is refused.
  const typeTile = (side: Team, unitId: number, input: HTMLInputElement): boolean => {
    const text = input.value.trim()
    const current = tileOf(side, unitId)
    if (text === '') {
      typeError.value = null
      if (current !== null) place(side, current, null)
      return true
    }
    const hexId = Number(text)
    const refused = config.refusal(side, hexId, text)
    if (refused === null) {
      typeError.value = null
      if (hexId !== current) place(side, hexId, unitId)
      return true
    }
    typeError.value = refused
    input.value = current === null ? '' : String(current)
    return false
  }

  // Enter places the unit and moves on to the next box, so a team is typed in
  // one go; a refused number keeps the box, selected for typing again.
  const typeTileAndNext = (
    side: Team,
    unitId: number,
    event: KeyboardEvent,
    boxes: HTMLInputElement[],
  ): void => {
    const input = event.target as HTMLInputElement
    if (!typeTile(side, unitId, input)) {
      input.select()
      return
    }
    const next = boxes[boxes.indexOf(input) + 1]
    if (next) {
      next.focus()
      next.select()
    } else {
      input.blur()
    }
  }

  return {
    nextUnits,
    choose,
    clickTile,
    hovered,
    preview,
    picker,
    pickerItems,
    pickedHere,
    pick,
    rows,
    typeError,
    typeTile,
    typeTileAndNext,
  }
}
