/* Collection store for one or more grid boards.
 *
 * Owns the array of GridContext boards, the active-board pointer, and the global
 * state shared by every board (hex size, team view, invert). Per-board state and
 * operations live on each GridContext (see useGridContext); this store holds only
 * what spans boards: the array, the active pointer, and the cross-board rules
 * (page-wide character + artifact uniqueness, drop routing and its validation
 * gates, place-on-active, remove-from-any-board).
 *
 * The single-grid Arena is setGridCount(1); the 5 v 5 page is setGridCount(5).
 */

import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import {
  createGridContext,
  findCharacterHex,
  type CharacterDropPayload,
  type GridContext,
} from '@/composables/useGridContext'
import {
  canPlaceCharacterOnTile,
  findTeamSynergyHex,
  getAvailableTeamSize,
  getCharacter,
  getCharacterTeam,
  getOpposingTeam,
  getTilesWithCharacters,
  getTilesWithCharactersByTeam,
  hasCharacter,
  isBaseHeroId,
  isCompanionUnitId,
  resolvePlacement,
} from '@/lib/characters/character'
import { repositionCompanions } from '@/lib/characters/companion'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { resolveReplacement } from '@/lib/characters/place'
import { isPlaceholderId } from '@/lib/characters/placeholder'
import { isSynergyHeroId } from '@/lib/characters/synergy'
import { rotatedHexId } from '@/lib/grid'
import type { Point } from '@/lib/layout'
import type { SideLoadBoard, SideLoadPlan } from '@/lib/teams/sideLoad'
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

export const artifactSlot = (
  slots: { ally: number | null; enemy: number | null },
  team: Team,
): number | null => (team === Team.ALLY ? slots.ally : slots.enemy)

export interface SideLoadOptions {
  // Mirror the formation 180 degrees onto the opposite team.
  invert: boolean
  // 'all': saved board i onto live board i; 'active': a single-board record
  // onto the active board.
  scope: 'all' | 'active'
}

export const useGrids = defineStore('grids', () => {
  const contexts = shallowRef<GridContext[]>([])
  const activeId = ref(0)

  // Global, shared by every board.
  const hexSize = ref<Point>({ x: 40, y: 40 })
  const hexSizeMode = ref<HexSizeMode>('breakpoint')
  const teamView = ref(false)
  // Renders every board rotated 180 degrees (the Invert toggle): a pure view
  // transform applied at the layout level, content stays canonical.
  const inverted = ref(false)
  // The Syn affordance. Never serialized or persisted: the placed unit is the
  // content, and deriveSynergy re-reads the boards after every restore path so
  // arriving state with a synergy unit lands with the box checked.
  const synergy = ref(false)

  const deriveSynergy = (): void => {
    synergy.value = contexts.value.some((ctx) =>
      getTilesWithCharacters(ctx.grid).some(
        (tile) => tile.characterId !== undefined && isSynergyHeroId(tile.characterId),
      ),
    )
  }

  // Destructive by design: unchecking clears both teams' assist slots so the
  // box always mirrors the board; only the checkbox routes here, restore paths
  // write the ref through deriveSynergy instead.
  const setSynergy = (value: boolean): void => {
    if (!value) {
      for (const ctx of contexts.value) {
        for (const team of [Team.ALLY, Team.ENEMY]) {
          const hex = findTeamSynergyHex(ctx.grid, team)
          if (hex !== null) ctx.remove(hex)
        }
      }
    }
    synergy.value = value
  }

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
      createGridContext(i, maps?.[i] ?? 'arena1', {
        hexSize,
        teamView,
        inverted,
        synergy,
        sharedCrop,
      }),
    )
    if (activeId.value >= clamped) activeId.value = 0
    deriveSynergy()
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

  // `exceptCtxId` excludes one board from the scan. Move/swap validators pass each
  // unit's DESTINATION board: in a swap the destination cell's current occupant is
  // itself vacating, and may even be the same character (one hero legally on both
  // teams of two boards), so counting it would false-reject a legal swap. A real
  // duplicate elsewhere on the destination board slips this pre-check but is
  // rejected by the engine's per-grid check at place time, with rollback.
  const isUsed = (characterId: number, team: Team, exceptCtxId?: number): boolean => {
    // Placeholder copies repeat freely (see placeholder.ts).
    if (isPlaceholderId(characterId)) return false
    const placement = findPlacement(characterId, team)
    return placement !== null && placement.ctxId !== exceptCtxId
  }

  // The id a roster pick lands as on a board, or null: the engine resolver
  // (judged against the post-vacate board when a target tile is given) plus
  // page-wide uniqueness, which still gates a base-id placement since the hero
  // may sit on another board's same team; the synergy id is invisible to it by
  // design. Every roster entry point (click, tap, popup, drag gate) goes
  // through here.
  const resolvePick = (
    ctx: GridContext,
    characterId: number,
    team: Team,
    targetHexId?: number,
  ): number | null => {
    const resolved =
      targetHexId === undefined
        ? resolvePlacement(ctx.grid, characterId, team, synergy.value)
        : resolveReplacement(ctx.grid, characterId, team, targetHexId, synergy.value)
    if (resolved === characterId && isUsed(characterId, team)) return null
    return resolved
  }

  const placeOnActive = (characterId: number, team: Team): boolean => {
    const ctx = active.value
    if (!ctx) return false
    const resolved = resolvePick(ctx, characterId, team)
    return resolved !== null && ctx.autoPlace(resolved, team)
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
      if (artifactSlot(ctx.artifacts, team) === artifactId) return { ctxId: ctx.id }
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
  // re-derive from their mains, phantimals are one-per-team per board, and
  // placeholders repeat by design, so all three are skipped.
  const dedupeCharacters = (): void => {
    const seen = new Set<string>()
    for (const ctx of contexts.value) {
      for (const tile of getTilesWithCharacters(ctx.grid)) {
        const characterId = tile.characterId
        if (characterId === undefined || tile.team === undefined) continue
        if (
          isCompanionUnitId(characterId) ||
          isPhantimalId(characterId) ||
          isPlaceholderId(characterId)
        )
          continue
        const key = `${tile.team}:${characterId}`
        if (seen.has(key)) ctx.remove(tile.hex.getId())
        else seen.add(key)
      }
    }
  }

  const placeUnit = (ctx: GridContext, hexId: number, unitId: number, team: Team): boolean =>
    isPhantimalId(unitId) ? ctx.placePhantimal(hexId, unitId, team) : ctx.place(hexId, unitId, team)

  // Cross-board move onto an empty cell: remove from the source, place on the
  // target, restore the source if the place fails. Routing-layer validation
  // (uniqueness, capacity, phantimal faction) ran in canDropCharacter; the moved
  // id is read from the live cell, the same authority the gate validated.
  const crossGridMove = (
    sourceCtx: GridContext,
    sourceHexId: number,
    targetCtx: GridContext,
    targetHexId: number,
    destTeam: Team,
  ): boolean => {
    const characterId = getCharacter(sourceCtx.grid, sourceHexId)
    const sourceTeam = getCharacterTeam(sourceCtx.grid, sourceHexId)
    if (characterId === undefined || sourceTeam === undefined) return false
    if (!sourceCtx.remove(sourceHexId)) return false
    if (placeUnit(targetCtx, targetHexId, characterId, destTeam)) {
      // Paragon follows the hero to its destination board and team.
      targetCtx.setParagon(destTeam, characterId, sourceCtx.takeParagon(sourceTeam, characterId))
      return true
    }
    placeUnit(sourceCtx, sourceHexId, characterId, sourceTeam) // rollback
    return false
  }

  // Cross-board swap of two occupied cells: remove both, place each on the
  // other's cell, restore both originals on any failure. Routing-layer validation
  // (uniqueness, companions, phantimal faction) ran in canDropCharacter.
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
    if (!sourceCtx.remove(sourceHexId)) return false
    if (!targetCtx.remove(targetHexId)) {
      placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback
      return false
    }
    const placedA = placeUnit(targetCtx, targetHexId, aId, bTeam)
    const placedB = placeUnit(sourceCtx, sourceHexId, bId, aTeam)
    if (placedA && placedB) {
      // Paragon follows each hero. Take both levels before writing either: a
      // same-hero cross-team swap (aId === bId) reuses a key.
      const aLevel = sourceCtx.takeParagon(aTeam, aId)
      const bLevel = targetCtx.takeParagon(bTeam, bId)
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
          !isCompanionUnitId(tile.characterId) &&
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
      const id = artifactSlot(artifacts, team)
      if (id !== null) ctx.setArtifact(team, id)
      else ctx.removeArtifact(team)
    }
  }

  // Exchange two boards' rosters (with paragon levels) and artifacts, keeping each
  // unit/artifact's team (ally <-> ally, enemy <-> enemy). Only directly-placed
  // mains move; companions, faction phantimals, and tile zones (e.g. Kulu's) are
  // skill-derived, so clearing deactivates them on the source and autoPlace
  // re-derives them on the destination. Nothing skill-driven is serialized or
  // carried, so none is left stranded (no ghost zones, no orphaned companions).
  // Placement picks random available tiles, so formations aren't preserved. The
  // target board becomes active.
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

  // The boards a side-load touches, shared by loadTeamSide and its read-only
  // confirm mirror below so the two can never drift.
  const sideLoadContexts = (scope: SideLoadOptions['scope']): GridContext[] =>
    scope === 'active' ? (active.value ? [active.value] : []) : contexts.value

  // Read-only mirror of loadTeamSide's clear phase (the canDropCharacter
  // pattern): the two-step confirm must promise exactly what the load removes.
  const sideLoadWouldReplace = (dest: Team, scope: SideLoadOptions['scope']): boolean =>
    sideLoadContexts(scope).some(
      (ctx) =>
        getTilesWithCharactersByTeam(ctx.grid, dest).length > 0 ||
        artifactSlot(ctx.artifacts, dest) !== null,
    )

  /* Stamp a one-side saved team (lib/teams/sideLoad) onto the live boards:
   * clear the destination side first via per-hex removal, the same delete path
   * the UI uses (skill cleanup, companion cascade), then place each unit on its
   * saved hex, falling back to a random tile when the live map assigns that
   * tile elsewhere or something already stands there. `invert` flips the
   * destination team and 180-rotates every saved hex; scope 'active' targets
   * only the active board (a 1v1 record loaded inside a multi-board mode).
   * Units page-wide uniqueness already claims, and units with no landing tile
   * at all, are skipped and counted. The other side, maps, and provenance are
   * untouched. */
  const loadTeamSide = (
    plan: SideLoadPlan,
    { invert, scope }: SideLoadOptions,
  ): { placed: number; skipped: number } => {
    const dest = invert ? getOpposingTeam(plan.side) : plan.side
    const ctxs = sideLoadContexts(scope)
    const boards = scope === 'active' ? plan.boards.slice(0, 1) : plan.boards
    const targets = boards.flatMap((board, i) => {
      const ctx = ctxs[i]
      return ctx ? [{ ctx, board }] : []
    })

    for (const { ctx } of targets) {
      for (const tile of getTilesWithCharactersByTeam(ctx.grid, dest)) {
        // A companion's removal cascades to its main, so later snapshot hexes
        // may already be empty.
        if (hasCharacter(ctx.grid, tile.hex.getId())) ctx.remove(tile.hex.getId())
      }
      ctx.removeArtifact(dest)
    }

    const targetHexFor = (ctx: GridContext, unit: { hexId: number }): number | undefined =>
      invert
        ? rotatedHexId(ctx.grid, unit.hexId)
        : ctx.grid.getHexByIdOrUndefined(unit.hexId)?.getId()

    // Stamp only onto a free destination tile. An occupied one holds this
    // load's own work (a placed main, or a skill-spawned companion the record
    // couldn't settle); replacing would cascade-remove the whole earlier unit,
    // so the incomer takes the random fallback instead.
    const stampableHex = (ctx: GridContext, unit: { hexId: number }): number | undefined => {
      const hexId = targetHexFor(ctx, unit)
      if (hexId === undefined) return undefined
      if (!canPlaceCharacterOnTile(ctx.grid, hexId, dest)) return undefined
      return hasCharacter(ctx.grid, hexId) ? undefined : hexId
    }

    // Settle a just-placed main's skill-spawned companions onto their saved
    // (rotated under invert) hexes, the same per-main pass the bulk restore
    // runs: left at a random spawn tile, a companion could squat on a later
    // unit's saved hex. A target that is off the destination zone or already
    // taken (by anything but a sibling companion) leaves that companion at its
    // spawn tile, so no unit is ever evicted.
    const settleCompanions = (ctx: GridContext, board: SideLoadBoard, mainUnitId: number): void => {
      const saved = board.companions.filter((companion) => companion.mainUnitId === mainUnitId)
      if (saved.length === 0) return
      const siblings = new Set(saved.map((companion) => companion.unitId))
      const settle = saved.flatMap((companion) => {
        const hexId = targetHexFor(ctx, companion)
        if (hexId === undefined || !canPlaceCharacterOnTile(ctx.grid, hexId, dest)) return []
        const occupant = getCharacter(ctx.grid, hexId)
        if (occupant !== undefined && !siblings.has(occupant)) return []
        return [{ companionId: companion.unitId, hexId }]
      })
      if (settle.length > 0) repositionCompanions(ctx.grid, dest, settle)
    }

    let placed = 0
    let skipped = 0
    for (const { ctx, board } of targets) {
      for (const unit of board.mains) {
        // Cleared boards can't conflict with a canonical record, but a crafted
        // one can repeat a hero; active-board scope can also collide with the
        // destination team of an untouched board.
        if (isUsed(unit.unitId, dest)) {
          skipped++
          continue
        }
        const hexId = stampableHex(ctx, unit)
        const ok =
          (hexId !== undefined && ctx.place(hexId, unit.unitId, dest)) ||
          ctx.autoPlace(unit.unitId, dest)
        if (!ok) {
          skipped++
          continue
        }
        placed++
        if (isBaseHeroId(unit.unitId)) ctx.setParagon(dest, unit.unitId, unit.paragon)
        settleCompanions(ctx, board, unit.unitId)
      }
      if (board.phantimal) {
        const hexId = stampableHex(ctx, board.phantimal)
        const ok =
          (hexId !== undefined && ctx.placePhantimal(hexId, board.phantimal.unitId, dest)) ||
          ctx.autoPlacePhantimal(board.phantimal.unitId, dest)
        if (ok) placed++
        else skipped++
      }
      // Per-team artifact uniqueness spans boards; a crafted duplicate drops.
      if (board.artifact !== null && !isArtifactUsed(board.artifact, dest)) {
        ctx.setArtifact(dest, board.artifact)
      }
      // Re-align the phantimal reconciler so a save that deliberately omits its
      // phantimal doesn't get one auto-placed after this batch.
      ctx.seedPhantimalBaseline()
    }
    deriveSynergy()
    return { placed, skipped }
  }

  // canDropCharacter's same-board leg: a move or swap that stays on one board can
  // still change a unit's team, which risks the same page-wide duplicate as a
  // cross-board transfer, a copy already on the destination team of another board.
  // Each unit is checked against its destination team excluding this board (an
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
    // Synergy heroes can't change teams (engine rule); reject here too so the
    // hover cue never promises a drop the engine will refuse.
    if (isSynergyHeroId(movingId)) return false
    if (residentId !== undefined && isSynergyHeroId(residentId)) return false
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

  // Read-only mirror of routeDrop's routing-layer validation, shared with the
  // drag hover cue (GridTiles) so hover never promises a drop the router rejects.
  // The engine's per-grid checks still have the last word at drop time: a
  // per-board rejection (a full team on a same-board team change, a companion
  // changing teams) or a mid-transaction failure resolves as a silent no-op.
  const canDropCharacter = (
    characterId: number,
    sourceGridId: number | undefined,
    sourceHexId: number | undefined,
    targetCtxId: number,
    targetHexId: number,
  ): boolean => {
    const targetCtx = getContext(targetCtxId)
    if (!targetCtx) return false
    const destTeam = getTeamFromTileState(targetCtx.grid.getTileById(targetHexId).state)
    if (destTeam === null) return false

    // Roster placement (an occupied target is a replace).
    if (sourceGridId === undefined || sourceHexId === undefined) {
      if (isPhantimalId(characterId)) return targetCtx.phantimalCanJoinTeam(characterId, destTeam)
      return resolvePick(targetCtx, characterId, destTeam, targetHexId) !== null
    }

    if (sourceGridId === targetCtxId) {
      return sameBoardDropKeepsUniqueness(targetCtxId, sourceHexId, targetHexId)
    }

    // Cross-board: the live source cell is authoritative, not the payload.
    const sourceCtx = getContext(sourceGridId)
    if (!sourceCtx) return false
    const movingId = getCharacter(sourceCtx.grid, sourceHexId)
    const sourceTeam = getCharacterTeam(sourceCtx.grid, sourceHexId)
    if (movingId === undefined || sourceTeam === undefined) return false
    // Companions can't leave their main's board; the synergy hero belongs to
    // its board's assist slot and can't leave either.
    if (isCompanionUnitId(movingId) || isSynergyHeroId(movingId)) return false

    const residentId = getCharacter(targetCtx.grid, targetHexId)
    if (residentId === undefined) {
      if (isPhantimalId(movingId)) return targetCtx.phantimalCanJoinTeam(movingId, destTeam)
      if (sourceTeam !== destTeam && isUsed(movingId, destTeam, targetCtxId)) return false
      return getAvailableTeamSize(targetCtx.grid, destTeam) > 0
    }

    // Swap: the mover lands on the resident's team and vice versa. Enforce
    // phantimal faction on each destination and page-wide uniqueness for any
    // unit whose team changes, excluding that unit's destination board: its
    // current occupant is the counterpart unit, which is itself vacating (and is
    // the same character when one hero's two legal placements are swapped).
    const residentTeam = getCharacterTeam(targetCtx.grid, targetHexId)
    if (residentTeam === undefined) return false
    if (isCompanionUnitId(residentId) || isSynergyHeroId(residentId)) return false
    if (isPhantimalId(movingId) && !targetCtx.phantimalCanJoinTeam(movingId, residentTeam)) {
      return false
    }
    if (isPhantimalId(residentId) && !sourceCtx.phantimalCanJoinTeam(residentId, sourceTeam)) {
      return false
    }
    if (
      !isPhantimalId(movingId) &&
      sourceTeam !== residentTeam &&
      isUsed(movingId, residentTeam, targetCtxId)
    ) {
      return false
    }
    if (
      !isPhantimalId(residentId) &&
      sourceTeam !== residentTeam &&
      isUsed(residentId, sourceTeam, sourceGridId)
    ) {
      return false
    }
    return true
  }

  // Resolve a drop onto a board. Roster and same-board drops use the board's own
  // handler (place/move/swap); cross-board drops compose remove + place. All
  // routing-layer validation is canDropCharacter, the same gate the hover cue
  // reads. A successful drop makes the destination board active (active follows
  // interaction, so a roster drop targets the board it just landed on).
  const routeDrop = (
    payload: CharacterDropPayload,
    targetCtxId: number,
    targetHexId: number,
  ): boolean => {
    const targetCtx = getContext(targetCtxId)
    if (!targetCtx) return false
    const sourceGridId = payload.character.sourceGridId
    const sourceHexId = payload.character.sourceHexId
    if (
      !canDropCharacter(payload.characterId, sourceGridId, sourceHexId, targetCtxId, targetHexId)
    ) {
      return false
    }
    if (sourceGridId === undefined || sourceGridId === targetCtxId) {
      const ok = targetCtx.handleDrop(payload, targetHexId)
      if (ok) activeId.value = targetCtxId
      return ok
    }
    const sourceCtx = getContext(sourceGridId)
    if (!sourceCtx || sourceHexId === undefined) return false
    const destTeam = getTeamFromTileState(targetCtx.grid.getTileById(targetHexId).state)
    if (destTeam === null) return false
    const ok = hasCharacter(targetCtx.grid, targetHexId)
      ? crossGridSwap(sourceCtx, sourceHexId, targetCtx, targetHexId)
      : crossGridMove(sourceCtx, sourceHexId, targetCtx, targetHexId, destTeam)
    if (ok) activeId.value = targetCtxId
    return ok
  }

  // Tap-lift drops go through routeDrop so they share every drag gate, including
  // handleDrop's same-board team-change rules (phantimal faction, one per team)
  // that a bare ctx.move would skip. The payload is built from the lifted cell.
  const routeLiftDrop = (
    fromCtxId: number,
    fromHexId: number,
    targetCtxId: number,
    targetHexId: number,
  ): boolean => {
    const fromCtx = getContext(fromCtxId)
    if (!fromCtx) return false
    const characterId = getCharacter(fromCtx.grid, fromHexId)
    if (characterId === undefined) return false
    return routeDrop(
      { character: { sourceHexId: fromHexId, sourceGridId: fromCtxId }, characterId },
      targetCtxId,
      targetHexId,
    )
  }

  // The rules for an artifact dropped onto a visible artifact cell (same or other
  // board, either team), shared by routeArtifactDrop and canDropArtifact. Per-team
  // uniqueness is re-checked only on a team change, excluding each artifact's
  // destination board so a copy on the other team of either board still counts.
  const resolveArtifactDrop = (
    payload: ArtifactDragPayload,
    targetCtxId: number,
    targetTeam: Team,
  ): {
    sourceCtx: GridContext
    targetCtx: GridContext
    moving: number
    resident: number | null
  } | null => {
    const { sourceCtxId, sourceTeam } = payload
    const sourceCtx = getContext(sourceCtxId)
    const targetCtx = getContext(targetCtxId)
    if (!sourceCtx || !targetCtx) return null
    if (sourceCtxId === targetCtxId && sourceTeam === targetTeam) return null

    // The live slot is authoritative, not the payload: it can change between
    // dragstart and drop.
    const moving = artifactSlot(sourceCtx.artifacts, sourceTeam)
    if (moving === null) return null
    const resident = artifactSlot(targetCtx.artifacts, targetTeam)
    if (resident === moving) return null

    if (sourceTeam !== targetTeam) {
      if (isArtifactUsed(moving, targetTeam, targetCtxId)) return null
      if (resident !== null && isArtifactUsed(resident, sourceTeam, sourceCtxId)) return null
    }
    return { sourceCtx, targetCtx, moving, resident }
  }

  // True if routeArtifactDrop would act on this drop; drives drag-over feedback so
  // hover never promises a drop the router rejects.
  const canDropArtifact = (
    payload: ArtifactDragPayload,
    targetCtxId: number,
    targetTeam: Team,
  ): boolean => resolveArtifactDrop(payload, targetCtxId, targetTeam) !== null

  // An empty target moves, an occupied target swaps: whatever the target held
  // (possibly nothing) returns to the source slot; a rejected drop is a silent
  // no-op. Arena is the sourceCtxId === targetCtxId case and Teams adds
  // cross-board, with no board-count branch. A successful drop makes the target
  // board active.
  const routeArtifactDrop = (
    payload: ArtifactDragPayload,
    targetCtxId: number,
    targetTeam: Team,
  ): boolean => {
    const drop = resolveArtifactDrop(payload, targetCtxId, targetTeam)
    if (!drop) return false
    // Slots resolved before any write, so write order is safe and a swap is atomic.
    drop.targetCtx.setArtifact(targetTeam, drop.moving)
    if (drop.resident !== null) drop.sourceCtx.setArtifact(payload.sourceTeam, drop.resident)
    else drop.sourceCtx.removeArtifact(payload.sourceTeam)
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
    synergy,
    deriveSynergy,
    setSynergy,
    setGridCount,
    setActive,
    getContext,
    findPlacement,
    isUsed,
    resolvePick,
    placeOnActive,
    removeFromAnyBoard,
    dedupeCharacters,
    findArtifactPlacement,
    isArtifactUsed,
    removeArtifactFromAnyBoard,
    canDropCharacter,
    routeDrop,
    routeLiftDrop,
    canDropArtifact,
    routeArtifactDrop,
    swapBoards,
    sideLoadWouldReplace,
    loadTeamSide,
    clearAll,
  }
})
