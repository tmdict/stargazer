/* Collection store for one or more grid boards.
 *
 * Owns the array of GridContext boards, the active-board pointer, and the global
 * state shared by every board (hex size, team-view flag). Per-board state and
 * operations live on each GridContext (see useGridContext); this store holds only
 * what spans boards: the array, the active pointer, and the cross-board rules
 * (page-wide character uniqueness, place-on-active, remove-from-any-board).
 *
 * The single-grid Arena is setGridCount(1); the 5 v 5 page is setGridCount(5).
 */

import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { createGridContext, findCharacterHex, type GridContext } from '@/composables/useGridContext'
import {
  getAvailableTeamSize,
  getCharacter,
  getCharacterTeam,
  hasCharacter,
} from '@/lib/characters/character'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { Point } from '@/lib/layout'
import type { CharacterType } from '@/lib/types/character'
import type { Team } from '@/lib/types/team'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

export type HexSizeMode = 'breakpoint' | 'fixed-medium'

export const useGrids = defineStore('grids', () => {
  const contexts = shallowRef<GridContext[]>([])
  const activeId = ref(0)

  // Global, shared by every board.
  const hexSize = ref<Point>({ x: 40, y: 40 })
  const hexSizeMode = ref<HexSizeMode>('breakpoint')
  const teamView = ref(false)
  // Presentation-only ally/enemy swap (see invertTeam). The engine stays canonical;
  // this flips every user-facing ally/enemy distinction (colors, labels, team view).
  const inverted = ref(false)

  const active = computed<GridContext | undefined>(() => contexts.value[activeId.value])

  // Team view crops every board by the same amount (the union of all boards' ally
  // extents) so the row stays even height. Null on a single board (the Arena),
  // where each board crops to its own extent.
  const sharedCrop = computed<{ minY: number; maxY: number } | null>(() => {
    if (!teamView.value || contexts.value.length <= 1) return null
    let minY = Infinity
    let maxY = -Infinity
    for (const ctx of contexts.value) {
      for (const hex of ctx.visibleHexes) {
        for (const c of ctx.layout.polygonCorners(hex)) {
          if (c.y < minY) minY = c.y
          if (c.y > maxY) maxY = c.y
        }
      }
    }
    return minY === Infinity ? null : { minY, maxY }
  })

  // (Re)build to exactly `count` boards. Disposes prior boards so their reactive
  // effects (per-board phantimal watchers) don't leak across reconfiguration.
  const setGridCount = (count: number, maps?: string[]): void => {
    contexts.value.forEach((ctx) => ctx.dispose())
    contexts.value = Array.from({ length: count }, (_, i) =>
      createGridContext(i, maps?.[i] ?? 'arena1', { hexSize, teamView, inverted, sharedCrop }),
    )
    if (activeId.value >= count) activeId.value = 0
  }

  const setActive = (id: number): void => {
    if (id >= 0 && id < contexts.value.length) activeId.value = id
  }

  const getContext = (id: number): GridContext | undefined =>
    contexts.value.find((ctx) => ctx.id === id)

  // Page-wide uniqueness: a character is unique per (character, team) across all
  // boards. Returns the board + hex where it sits, or null.
  const findPlacement = (
    characterId: number,
    team: Team,
  ): { ctxId: number; hexId: number } | null => {
    for (const ctx of contexts.value) {
      const hexId = findCharacterHex(ctx.grid, characterId, team)
      if (hexId !== null) return { ctxId: ctx.id, hexId }
    }
    return null
  }

  // `exceptCtxId` excludes a board (the drag source) so a same-team cross-board
  // move isn't rejected as a duplicate of itself.
  const isUsed = (characterId: number, team: Team, exceptCtxId?: number): boolean => {
    const placement = findPlacement(characterId, team)
    return placement !== null && placement.ctxId !== exceptCtxId
  }

  const placeOnActive = (characterId: number, team: Team): boolean => {
    if (!active.value || isUsed(characterId, team)) return false
    return active.value.autoPlace(characterId, team)
  }

  const removeFromAnyBoard = (characterId: number, team: Team): boolean => {
    const placement = findPlacement(characterId, team)
    if (!placement) return false
    return getContext(placement.ctxId)?.remove(placement.hexId) ?? false
  }

  const clearAll = (): void => contexts.value.forEach((ctx) => ctx.clear())

  const isCompanion = (id: number): boolean => id >= COMPANION_ID_OFFSET && !isPhantimalId(id)

  const placeUnit = (ctx: GridContext, hexId: number, unitId: number, team: Team): boolean =>
    isPhantimalId(unitId) ? ctx.placePhantimal(hexId, unitId, team) : ctx.place(hexId, unitId, team)

  // Cross-board move onto an empty cell: validate the destination, remove from
  // the source, place on the target; restore the source if the place fails.
  const crossGridMove = (
    sourceCtx: GridContext,
    sourceHexId: number,
    targetCtx: GridContext,
    targetHexId: number,
    characterId: number,
    destTeam: Team,
  ): boolean => {
    if (isPhantimalId(characterId)) {
      if (!targetCtx.phantimalCanJoinTeam(characterId, destTeam)) return false
    } else {
      if (isUsed(characterId, destTeam, sourceCtx.id)) return false
      if (getAvailableTeamSize(targetCtx.grid, destTeam) <= 0) return false
    }
    const sourceTeam = getCharacterTeam(sourceCtx.grid, sourceHexId)
    if (sourceTeam === undefined) return false
    if (!sourceCtx.remove(sourceHexId)) return false
    if (placeUnit(targetCtx, targetHexId, characterId, destTeam)) return true
    placeUnit(sourceCtx, sourceHexId, characterId, sourceTeam) // rollback
    return false
  }

  // Cross-board swap of two occupied cells: validate both destinations, remove
  // both, place each on the other's cell; restore both originals on any failure.
  const crossGridSwap = (
    sourceCtx: GridContext,
    sourceHexId: number,
    targetCtx: GridContext,
    targetHexId: number,
  ): boolean => {
    const aId = getCharacter(sourceCtx.grid, sourceHexId)
    const bId = getCharacter(targetCtx.grid, targetHexId)
    const aTeam = getCharacterTeam(sourceCtx.grid, sourceHexId)
    const bTeam = getCharacterTeam(targetCtx.grid, targetHexId)
    if (aId === undefined || bId === undefined || aTeam === undefined || bTeam === undefined) {
      return false
    }
    if (isCompanion(aId) || isCompanion(bId)) return false
    // After the swap A sits on the target team and B on the source team. Enforce
    // phantimal faction on each destination and page-wide uniqueness for any
    // character whose team actually changes.
    if (isPhantimalId(aId) && !targetCtx.phantimalCanJoinTeam(aId, bTeam)) return false
    if (isPhantimalId(bId) && !sourceCtx.phantimalCanJoinTeam(bId, aTeam)) return false
    if (!isPhantimalId(aId) && aTeam !== bTeam && isUsed(aId, bTeam, sourceCtx.id)) return false
    if (!isPhantimalId(bId) && aTeam !== bTeam && isUsed(bId, aTeam, targetCtx.id)) return false

    if (!sourceCtx.remove(sourceHexId)) return false
    if (!targetCtx.remove(targetHexId)) {
      placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback
      return false
    }
    const placedA = placeUnit(targetCtx, targetHexId, aId, bTeam)
    const placedB = placeUnit(sourceCtx, sourceHexId, bId, aTeam)
    if (placedA && placedB) return true
    if (placedA) targetCtx.remove(targetHexId)
    if (placedB) sourceCtx.remove(sourceHexId)
    placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback to originals
    placeUnit(targetCtx, targetHexId, bId, bTeam)
    return false
  }

  // Resolve a drop onto a board. Roster and same-board drops use the board's own
  // handler (place/move/swap); cross-board drops compose remove + place. The
  // destination board becomes active (decision: active follows a cross-grid drop).
  const routeDrop = (
    payload: { character: CharacterType; characterId: number },
    targetCtxId: number,
    targetHexId: number,
  ): boolean => {
    const targetCtx = getContext(targetCtxId)
    if (!targetCtx) return false
    const sourceGridId = payload.character.sourceGridId
    if (sourceGridId === undefined || sourceGridId === targetCtxId) {
      // Roster drops (new placements) must respect page-wide character uniqueness;
      // same-board drags are moves/swaps and don't add a unit.
      if (sourceGridId === undefined && !isPhantimalId(payload.characterId)) {
        const destTeam = getTeamFromTileState(targetCtx.grid.getTileById(targetHexId).state)
        if (destTeam !== null && isUsed(payload.characterId, destTeam)) return false
      }
      return targetCtx.handleDrop(payload, targetHexId)
    }
    const sourceCtx = getContext(sourceGridId)
    const sourceHexId = payload.character.sourceHexId
    if (!sourceCtx || sourceHexId === undefined) return false
    if (isCompanion(payload.characterId)) return false // companions can't leave their main's board
    const destTeam = getTeamFromTileState(targetCtx.grid.getTileById(targetHexId).state)
    if (destTeam === null) return false
    const ok = hasCharacter(targetCtx.grid, targetHexId)
      ? crossGridSwap(sourceCtx, sourceHexId, targetCtx, targetHexId)
      : crossGridMove(sourceCtx, sourceHexId, targetCtx, targetHexId, payload.characterId, destTeam)
    if (ok) activeId.value = targetCtxId
    return ok
  }

  // Always start with one board so single-grid consumers (the Arena) have an
  // active context immediately; pages override the count (5 v 5 -> 5).
  setGridCount(1)

  return {
    contexts,
    activeId,
    active,
    hexSize,
    hexSizeMode,
    teamView,
    inverted,
    setGridCount,
    setActive,
    getContext,
    findPlacement,
    isUsed,
    placeOnActive,
    removeFromAnyBoard,
    routeDrop,
    clearAll,
  }
})
