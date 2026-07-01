/* Collection store for one or more grid boards.
 *
 * Owns the array of GridContext boards, the active-board pointer, and the global
 * state shared by every board (hex size, team-view flag). Per-board state and
 * operations live on each GridContext (see useGridContext); this store holds only
 * what spans boards: the array, the active pointer, and the cross-board rules
 * (page-wide character + artifact uniqueness, place-on-active, remove-from-any-board).
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
  getTilesWithCharacters,
  hasCharacter,
} from '@/lib/characters/character'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { COMPANION_ID_OFFSET } from '@/lib/grid'
import type { Point } from '@/lib/layout'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

export type HexSizeMode = 'breakpoint' | 'fixed-medium'

// Largest supported board configuration (5 v 5). setGridCount clamps to it so a
// crafted share URL can't build an arbitrary number of boards.
export const MAX_GRID_COUNT = 5

// Payload for an artifact dragged between artifact cells. It carries no artifact id:
// routeArtifactDrop reads the live source slot, which is authoritative at drop time.
export interface ArtifactDragPayload {
  sourceCtxId: number
  sourceTeam: Team
}

export const artifactSlot = (ctx: GridContext, team: Team): number | null =>
  team === Team.ALLY ? ctx.artifacts.ally : ctx.artifacts.enemy

export const useGrids = defineStore('grids', () => {
  const contexts = shallowRef<GridContext[]>([])
  const activeId = ref(0)

  // Global, shared by every board.
  const hexSize = ref<Point>({ x: 40, y: 40 })
  const hexSizeMode = ref<HexSizeMode>('breakpoint')
  const teamView = ref(false)
  // Presentation relabel flag (see invertTeam): flips every user-facing ally/enemy
  // distinction (colors, labels, team view) while the engine stays canonical. The
  // invert toggle pairs setting this with a unit mirror-swap (swapTeamsAllBoards).
  const inverted = ref(false)

  const active = computed<GridContext | undefined>(() => contexts.value[activeId.value])

  // Team view crops every board by the same amount (the union of all boards' shown
  // extents) so the row stays even-sized. Null on a single board (the Arena), where
  // each board crops to its own extent.
  const sharedCrop = computed<{
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null>(() => {
    if (!teamView.value || contexts.value.length <= 1) return null
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const ctx of contexts.value) {
      for (const hex of ctx.cropHexes) {
        for (const c of ctx.layout.polygonCorners(hex)) {
          if (c.x < minX) minX = c.x
          if (c.x > maxX) maxX = c.x
          if (c.y < minY) minY = c.y
          if (c.y > maxY) maxY = c.y
        }
      }
    }
    return minY === Infinity ? null : { minX, maxX, minY, maxY }
  })

  // (Re)build to exactly `count` boards (clamped to [1, MAX_GRID_COUNT]). Disposes
  // prior boards so their reactive effects (per-board phantimal watchers) don't
  // leak across reconfiguration.
  const setGridCount = (count: number, maps?: (string | undefined)[]): void => {
    const clamped = Math.min(Math.max(count, 1), MAX_GRID_COUNT)
    contexts.value.forEach((ctx) => ctx.dispose())
    contexts.value = Array.from({ length: clamped }, (_, i) =>
      createGridContext(i, maps?.[i] ?? 'arena1', { hexSize, teamView, inverted, sharedCrop }),
    )
    if (activeId.value >= clamped) activeId.value = 0
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

  // `exceptCtxId` excludes one board from the scan. Callers validating a move/swap
  // pass the character's DESTINATION board, so the slot it is about to occupy is not
  // counted as a conflict (a copy on the other team of either board still is).
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

  // Page-wide per-team artifact uniqueness (one artifact per team across all
  // boards), mirroring findPlacement/isUsed/removeFromAnyBoard for characters.
  const findArtifactPlacement = (artifactId: number, team: Team): { ctxId: number } | null => {
    for (const ctx of contexts.value) {
      const id = team === Team.ALLY ? ctx.artifacts.ally : ctx.artifacts.enemy
      if (id === artifactId) return { ctxId: ctx.id }
    }
    return null
  }

  // `exceptCtxId` excludes one board from the scan: callers validating a move/swap
  // pass the artifact's DESTINATION board so the slot it is about to occupy is not
  // counted; omit it to scan every board (placement / picker hiding).
  const isArtifactUsed = (artifactId: number, team: Team, exceptCtxId?: number): boolean => {
    const placement = findArtifactPlacement(artifactId, team)
    return placement !== null && placement.ctxId !== exceptCtxId
  }

  const removeArtifactFromAnyBoard = (artifactId: number, team: Team): boolean => {
    const placement = findArtifactPlacement(artifactId, team)
    if (!placement) return false
    getContext(placement.ctxId)?.removeArtifact(team)
    return true
  }

  const clearAll = (): void => contexts.value.forEach((ctx) => ctx.clear())

  // Repair page-wide (character, team) uniqueness after a bulk restore: keep each
  // pair's first placement (board order) and remove later copies. Companions
  // re-derive from their mains and phantimals are one-per-team per board, so both
  // are skipped.
  const dedupeCharacters = (): void => {
    const seen = new Set<string>()
    for (const ctx of contexts.value) {
      for (const tile of getTilesWithCharacters(ctx.grid)) {
        const characterId = tile.characterId
        if (characterId === undefined || tile.team === undefined) continue
        if (isCompanion(characterId) || isPhantimalId(characterId)) continue
        const key = `${tile.team}:${characterId}`
        if (seen.has(key)) ctx.remove(tile.hex.getId())
        else seen.add(key)
      }
    }
  }

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
    const sourceTeam = getCharacterTeam(sourceCtx.grid, sourceHexId)
    if (sourceTeam === undefined) return false
    if (isPhantimalId(characterId)) {
      if (!targetCtx.phantimalCanJoinTeam(characterId, destTeam)) return false
    } else {
      // Only a team change can break per-team uniqueness; exclude the destination
      // board so a copy on the other team of the source board is still counted.
      if (sourceTeam !== destTeam && isUsed(characterId, destTeam, targetCtx.id)) return false
      if (getAvailableTeamSize(targetCtx.grid, destTeam) <= 0) return false
    }
    if (!sourceCtx.remove(sourceHexId)) return false
    if (placeUnit(targetCtx, targetHexId, characterId, destTeam)) {
      // Paragon follows the hero to its destination board and team.
      targetCtx.setParagon(destTeam, characterId, sourceCtx.getParagon(sourceTeam, characterId))
      sourceCtx.setParagon(sourceTeam, characterId, 0)
      return true
    }
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
    // character whose team changes, excluding that character's destination board so
    // a copy on the other team of either board is still counted.
    if (isPhantimalId(aId) && !targetCtx.phantimalCanJoinTeam(aId, bTeam)) return false
    if (isPhantimalId(bId) && !sourceCtx.phantimalCanJoinTeam(bId, aTeam)) return false
    if (!isPhantimalId(aId) && aTeam !== bTeam && isUsed(aId, bTeam, targetCtx.id)) return false
    if (!isPhantimalId(bId) && aTeam !== bTeam && isUsed(bId, aTeam, sourceCtx.id)) return false

    if (!sourceCtx.remove(sourceHexId)) return false
    if (!targetCtx.remove(targetHexId)) {
      placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback
      return false
    }
    const placedA = placeUnit(targetCtx, targetHexId, aId, bTeam)
    const placedB = placeUnit(sourceCtx, sourceHexId, bId, aTeam)
    if (placedA && placedB) {
      // Paragon follows each hero. Clear both old keys before writing the new
      // ones: a same-hero cross-team swap (aId === bId) reuses a key.
      const aLevel = sourceCtx.getParagon(aTeam, aId)
      const bLevel = targetCtx.getParagon(bTeam, bId)
      sourceCtx.setParagon(aTeam, aId, 0)
      targetCtx.setParagon(bTeam, bId, 0)
      targetCtx.setParagon(bTeam, aId, aLevel)
      sourceCtx.setParagon(aTeam, bId, bLevel)
      return true
    }
    if (placedA) targetCtx.remove(targetHexId)
    if (placedB) sourceCtx.remove(sourceHexId)
    placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback to originals
    placeUnit(targetCtx, targetHexId, bId, bTeam)
    return false
  }

  // A board's directly-placed roster: the main characters with their paragon
  // levels, dropping skill-derived units (companions, faction phantimals) since
  // those re-derive from the roster.
  const collectMainUnits = (
    ctx: GridContext,
  ): { characterId: number; team: Team; paragon: number }[] =>
    getTilesWithCharacters(ctx.grid)
      .filter(
        (tile) =>
          tile.characterId !== undefined &&
          tile.team !== undefined &&
          !isCompanion(tile.characterId) &&
          !isPhantimalId(tile.characterId),
      )
      .map((tile) => ({
        characterId: tile.characterId!,
        team: tile.team!,
        paragon: ctx.getParagon(tile.team!, tile.characterId!),
      }))

  const applyArtifacts = (
    ctx: GridContext,
    artifacts: { ally: number | null; enemy: number | null },
  ): void => {
    for (const team of [Team.ALLY, Team.ENEMY]) {
      const id = team === Team.ALLY ? artifacts.ally : artifacts.enemy
      if (id !== null) ctx.setArtifact(team, id)
      else ctx.removeArtifact(team)
    }
  }

  // Exchange two boards' rosters (with paragon levels) and artifacts, keeping each
  // unit/artifact's team (ally <-> ally, enemy <-> enemy). Only directly-placed
  // mains move; companions, faction phantimals, and tile zones (e.g. Kulu's) are
  // skill-derived, so
  // clearing deactivates them on the source and autoPlace re-derives them on the
  // destination. Nothing skill-driven is serialized or carried, so none is left
  // stranded (no ghost zones, no orphaned companions). Placement picks random
  // available tiles, so formations aren't preserved. The target board becomes
  // active.
  const swapBoards = (sourceId: number, targetId: number): boolean => {
    if (sourceId === targetId) return false
    const source = contexts.value[sourceId]
    const target = contexts.value[targetId]
    if (!source || !target) return false

    const fromSource = collectMainUnits(source)
    const fromTarget = collectMainUnits(target)
    const sourceArtifacts = { ...source.artifacts }
    const targetArtifacts = { ...target.artifacts }

    // Clear both before placing so a unit crossing boards never transiently
    // duplicates its pre-swap copy under page-wide per-team uniqueness.
    source.clearCharacters()
    target.clearCharacters()
    // Re-seed each now-empty board's phantimal baseline so the post-placement
    // reconcile reads the incoming roster as a fresh qualifying transition and
    // re-derives the phantimal, even when both boards ran the same faction.
    source.seedPhantimalBaseline()
    target.seedPhantimalBaseline()

    // clearCharacters wiped both paragon maps, so restore each hero's level with it.
    fromTarget.forEach((unit) => {
      if (source.autoPlace(unit.characterId, unit.team)) {
        source.setParagon(unit.team, unit.characterId, unit.paragon)
      }
    })
    fromSource.forEach((unit) => {
      if (target.autoPlace(unit.characterId, unit.team)) {
        target.setParagon(unit.team, unit.characterId, unit.paragon)
      }
    })

    applyArtifacts(source, targetArtifacts)
    applyArtifacts(target, sourceArtifacts)

    activeId.value = targetId
    return true
  }

  // A move or swap that stays on one board can still change a unit's team, which
  // risks the same page-wide duplicate as a cross-board transfer: a copy already
  // on the destination team of another board. Mirrors crossGridMove/crossGridSwap:
  // each unit is checked against its destination team excluding this board (an
  // on-board conflict is already rejected by the engine's per-grid check), and
  // phantimals are exempt (capped at one per team per board instead).
  const sameBoardDropKeepsUniqueness = (
    ctxId: number,
    sourceHexId: number,
    targetHexId: number,
  ): boolean => {
    const ctx = getContext(ctxId)
    if (!ctx) return false
    const movingId = getCharacter(ctx.grid, sourceHexId)
    const movingTeam = getCharacterTeam(ctx.grid, sourceHexId)
    if (movingId === undefined || movingTeam === undefined) return true
    const residentId = getCharacter(ctx.grid, targetHexId)
    const destTeam =
      residentId !== undefined
        ? getCharacterTeam(ctx.grid, targetHexId)
        : getTeamFromTileState(ctx.grid.getTileById(targetHexId).state)
    if (destTeam === undefined || destTeam === null || destTeam === movingTeam) return true
    if (!isPhantimalId(movingId) && isUsed(movingId, destTeam, ctxId)) return false
    if (
      residentId !== undefined &&
      !isPhantimalId(residentId) &&
      isUsed(residentId, movingTeam, ctxId)
    ) {
      return false
    }
    return true
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
      // Roster drops (new placements) must respect page-wide character uniqueness.
      if (sourceGridId === undefined && !isPhantimalId(payload.characterId)) {
        const destTeam = getTeamFromTileState(targetCtx.grid.getTileById(targetHexId).state)
        if (destTeam !== null && isUsed(payload.characterId, destTeam)) return false
      }
      // Same-board drags must too when the drop changes the unit's team.
      const sourceHexId = payload.character.sourceHexId
      if (
        sourceGridId !== undefined &&
        sourceHexId !== undefined &&
        !sameBoardDropKeepsUniqueness(targetCtxId, sourceHexId, targetHexId)
      ) {
        return false
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

  // Resolve an artifact dropped onto a visible artifact cell (same or other board,
  // either team). An empty target moves, an occupied target swaps: whatever the
  // target held (possibly nothing) returns to the source slot. Per-team uniqueness is
  // re-checked only on a team change, excluding each artifact's destination board so a
  // copy on the other team of either board still counts; a rejected drop is a silent
  // no-op. Arena is the sourceCtxId === targetCtxId case and Teams adds cross-board,
  // with no board-count branch. A successful drop makes the target board active.
  const routeArtifactDrop = (
    payload: ArtifactDragPayload,
    targetCtxId: number,
    targetTeam: Team,
  ): boolean => {
    const { sourceCtxId, sourceTeam } = payload
    const sourceCtx = getContext(sourceCtxId)
    const targetCtx = getContext(targetCtxId)
    if (!sourceCtx || !targetCtx) return false
    if (sourceCtxId === targetCtxId && sourceTeam === targetTeam) return false

    const moving = artifactSlot(sourceCtx, sourceTeam)
    if (moving === null) return false
    const resident = artifactSlot(targetCtx, targetTeam)
    if (resident === moving) return false

    if (sourceTeam !== targetTeam) {
      if (isArtifactUsed(moving, targetTeam, targetCtxId)) return false
      if (resident !== null && isArtifactUsed(resident, sourceTeam, sourceCtxId)) return false
    }

    // Values captured above, so write order is safe and the swap is atomic.
    targetCtx.setArtifact(targetTeam, moving)
    if (resident !== null) sourceCtx.setArtifact(sourceTeam, resident)
    else sourceCtx.removeArtifact(sourceTeam)
    activeId.value = targetCtxId
    return true
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
    dedupeCharacters,
    findArtifactPlacement,
    isArtifactUsed,
    removeArtifactFromAnyBoard,
    sameBoardDropKeepsUniqueness,
    routeDrop,
    routeArtifactDrop,
    swapBoards,
    clearAll,
  }
})
