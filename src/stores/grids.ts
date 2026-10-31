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

import { computed, ref, shallowRef, watch } from 'vue'
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
  getAllAvailableTilesForTeam,
  getAvailableTeamSize,
  getCharacter,
  getCharacterTeam,
  getOpposingTeam,
  getTilesWithCharacters,
  getTilesWithCharactersByTeam,
  hasCharacter,
  isCompanionUnitId,
  resolvePlacement,
} from '@/lib/characters/character'
import { getCompanions, repositionCompanions } from '@/lib/characters/companion'
import { isPhantimalId } from '@/lib/characters/phantimal'
import { resolveReplacement } from '@/lib/characters/place'
import { isPlaceholderId } from '@/lib/characters/placeholder'
import { isSynergyHeroId } from '@/lib/characters/synergy'
import { rotatedHexId } from '@/lib/grid'
import type { Point } from '@/lib/layout'
import { DEFAULT_MAP_KEY } from '@/lib/maps'
import type { SkillRow } from '@/lib/skills/skill'
import {
  sideLoadBoard,
  type SideLoadBoard,
  type SideLoadPlan,
  type SideLoadUnit,
} from '@/lib/teams/sideLoad'
import type { TeamImportPlan } from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'
import { serializeGridState } from '@/utils/gridStateSerializer'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'
import { useRosters } from './rosters'

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

// One team's units and artifact, held while their board is swapped or moved
// to another map.
interface CapturedSide {
  team: Team
  side: SideLoadBoard
}

export const useGrids = defineStore('grids', () => {
  const rosters = useRosters()
  const contexts = shallowRef<GridContext[]>([])
  const activeId = ref(0)

  // Global, shared by every board.
  const hexSize = ref<Point>({ x: 40, y: 40 })
  const hexSizeMode = ref<HexSizeMode>('breakpoint')
  const teamView = ref(false)
  // Renders every board rotated 180 degrees (the Invert toggle): a pure view
  // transform applied at the layout level, content stays canonical.
  const inverted = ref(false)
  // The perspective view (the Flat toggle unticked): squashed by the container,
  // tilted by the layout, so it is the same kind of view transform as invert.
  const perspective = ref(false)
  // The Syn affordance. Never serialized or persisted: the placed unit is the
  // content, and deriveSynergy re-reads the boards after every restore path so
  // arriving state with a synergy unit lands with the box checked.
  const synergy = ref(false)
  // What the Skills dropdown has turned off. Never serialized or persisted, so
  // a reload or a share link shows every drawing.
  const hiddenSkills = shallowRef<ReadonlySet<string>>(new Set())

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

  // A key is unique across boards but for a hero and its synergy copy, which
  // share a row that draws if either does.
  const skillRows = computed<SkillRow[]>(() => {
    const rows = new Map<string, SkillRow>()
    for (const row of contexts.value.flatMap((ctx) => ctx.skillRows)) {
      if (row.drawing || !rows.has(row.key)) rows.set(row.key, row)
    }
    return [...rows.values()]
  })

  const setSkillsHidden = (keys: readonly string[], hidden: boolean): void => {
    const next = new Set(hiddenSkills.value)
    for (const key of keys) {
      if (hidden) next.add(key)
      else next.delete(key)
    }
    hiddenSkills.value = next
  }

  // A unit taken off the boards comes back visible, as its upgrades reset.
  watch(skillRows, (rows) => {
    const present = new Set(rows.map((row) => row.key))
    const kept = [...hiddenSkills.value].filter((key) => present.has(key))
    if (kept.length !== hiddenSkills.value.size) hiddenSkills.value = new Set(kept)
  })

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
      createGridContext(i, maps?.[i] ?? DEFAULT_MAP_KEY, {
        hexSize,
        teamView,
        inverted,
        perspective,
        synergy,
        sharedCrop,
        hiddenSkills,
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

  // The id a pick from the hero picker lands as on a board, or null: the engine
  // resolver (judged against the post-vacate board when a target tile is given)
  // plus page-wide uniqueness, which still gates a base-id placement since the
  // hero may sit on another board's same team; the synergy id is invisible to it
  // by design. Every picker entry point (click, tap, popup, drag gate) goes
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

  // A hero picked from the picker starts at the active roster's levels.
  // setAttrs ignores units that carry none (a synergy copy, a placeholder).
  const applyRosterLevels = (ctx: GridContext, unitId: number, team: Team): void => {
    const levels = rosters.levelsFor(unitId)
    if (levels) ctx.setAttrs(team, unitId, levels)
  }

  // Every pick that is not a drag (click, tap on a targeted tile, the
  // empty-tile popup, search) places through here: onto `hexId` when given,
  // else onto a free tile.
  const placePick = (
    ctx: GridContext,
    characterId: number,
    team: Team,
    hexId?: number,
  ): boolean => {
    const resolved = resolvePick(ctx, characterId, team, hexId)
    if (resolved === null) return false
    const placed =
      hexId === undefined ? ctx.autoPlace(resolved, team) : ctx.place(hexId, resolved, team)
    if (placed) applyRosterLevels(ctx, resolved, team)
    return placed
  }

  const placeOnActive = (characterId: number, team: Team): boolean => {
    const ctx = active.value
    return ctx !== undefined && placePick(ctx, characterId, team)
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

  const clearSide = (team: Team): void => contexts.value.forEach((ctx) => ctx.clearTeam(team))

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
    // Read before the remove, which drops the hero's record from its board.
    const record = sourceCtx.getAttrs(sourceTeam, characterId)
    if (!sourceCtx.remove(sourceHexId)) return false
    if (placeUnit(targetCtx, targetHexId, characterId, destTeam)) {
      targetCtx.setAttrs(destTeam, characterId, record)
      return true
    }
    placeUnit(sourceCtx, sourceHexId, characterId, sourceTeam) // rollback
    sourceCtx.setAttrs(sourceTeam, characterId, record)
    return false
  }

  // Cross-board swap of two occupied cells: remove both, place each on the
  // other's cell, restore both originals on any failure. Routing-layer validation
  // (uniqueness, companions, phantimal faction, capacity) ran in canDropCharacter.
  // The second placement waits for the first to succeed: a placement can evict
  // a board's phantimal (one per team), which a rollback could not restore.
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
    // Read before the removes, which drop both records from their boards.
    const aRecord = sourceCtx.getAttrs(aTeam, aId)
    const bRecord = targetCtx.getAttrs(bTeam, bId)
    if (!sourceCtx.remove(sourceHexId)) return false
    if (!targetCtx.remove(targetHexId)) {
      placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback
      sourceCtx.setAttrs(aTeam, aId, aRecord)
      return false
    }
    const placedA = placeUnit(targetCtx, targetHexId, aId, bTeam)
    if (placedA && placeUnit(sourceCtx, sourceHexId, bId, aTeam)) {
      targetCtx.setAttrs(bTeam, aId, aRecord)
      sourceCtx.setAttrs(aTeam, bId, bRecord)
      return true
    }
    if (placedA) targetCtx.remove(targetHexId)
    placeUnit(sourceCtx, sourceHexId, aId, aTeam) // rollback to originals
    placeUnit(targetCtx, targetHexId, bId, bTeam)
    sourceCtx.setAttrs(aTeam, aId, aRecord)
    targetCtx.setAttrs(bTeam, bId, bRecord)
    return false
  }

  /* The placement every lineup move shares (the Load menu, the board swap, a
   * map change): a unit stands on its own hex when the board gives that hex
   * to `dest`, else on a random free tile that no other unit of the side
   * keeps. `invert` 180-rotates every hex. Units page-wide uniqueness already
   * claims, units with no tile left, and the side's left-out units are skipped
   * and counted. */
  const placeSide = (
    ctx: GridContext,
    side: SideLoadBoard,
    dest: Team,
    invert = false,
  ): { placed: number; skipped: number } => {
    const ownHex = (unit: { hexId?: number }): number | undefined => {
      if (unit.hexId === undefined) return undefined
      const hexId = invert
        ? rotatedHexId(ctx.grid, unit.hexId)
        : ctx.grid.getHexByIdOrUndefined(unit.hexId)?.getId()
      return hexId !== undefined && canPlaceCharacterOnTile(ctx.grid, hexId, dest)
        ? hexId
        : undefined
    }
    const kept = new Set<number>()
    for (const unit of [...side.mains, ...side.companions, side.phantimal]) {
      const hexId = unit ? ownHex(unit) : undefined
      if (hexId !== undefined) kept.add(hexId)
    }

    /* Companions spawn on random tiles: each moves onto its own hex or, with
     * that hex gone, off a hex the side keeps. A move is dropped when its
     * target's occupant stays put, so no unit is ever evicted; that can close
     * another move's target, hence the loop. */
    const settleCompanions = (mainUnitId: number): void => {
      const spare = getAllAvailableTilesForTeam(ctx.grid, dest)
        .map((tile) => tile.hex.getId())
        .filter((hexId) => !kept.has(hexId))
      let moves = [...getCompanions(ctx.grid, mainUnitId, dest)].flatMap((companionId) => {
        const saved = side.companions.find((companion) => companion.unitId === companionId)
        const own = saved && ownHex(saved)
        if (own !== undefined) return [{ companionId, hexId: own }]
        const at = findCharacterHex(ctx.grid, companionId, dest)
        if (at === null || !kept.has(at)) return []
        const [hexId] = spare.splice(Math.floor(Math.random() * spare.length), 1)
        return hexId === undefined ? [] : [{ companionId, hexId }]
      })
      let closed = true
      while (closed) {
        const moving = new Set(moves.map((move) => move.companionId))
        const open = moves.filter(({ hexId }) => {
          const occupant = getCharacter(ctx.grid, hexId)
          return occupant === undefined || moving.has(occupant)
        })
        closed = open.length < moves.length
        moves = open
      }
      if (moves.length > 0) repositionCompanions(ctx.grid, dest, moves)
    }

    let placed = 0
    let skipped = side.leftOut ?? 0
    // An occupied own hex holds a unit this batch could not move off it;
    // replacing would cascade-remove that unit, so the incomer goes random.
    const land = (
      unit: SideLoadUnit,
      place: (hexId: number) => boolean,
      autoPlace: () => boolean,
    ): boolean => {
      const hexId = ownHex(unit)
      const landed =
        (hexId !== undefined && !hasCharacter(ctx.grid, hexId) && place(hexId)) || autoPlace()
      if (landed) {
        placed++
        settleCompanions(unit.unitId)
      } else skipped++
      return landed
    }

    for (const unit of side.mains) {
      // Cleared boards can't conflict with a canonical record, but a crafted
      // one can repeat a hero; active-board scope can also collide with the
      // destination team of an untouched board.
      if (isUsed(unit.unitId, dest)) {
        skipped++
        continue
      }
      const landed = land(
        unit,
        (hexId) => ctx.place(hexId, unit.unitId, dest),
        () => ctx.autoPlace(unit.unitId, dest, kept),
      )
      if (landed && unit.attrs) ctx.setAttrs(dest, unit.unitId, unit.attrs)
    }
    // After the heroes: the faction check reads the lineup.
    const phantimal = side.phantimal
    if (phantimal) {
      land(
        phantimal,
        (hexId) => ctx.placePhantimal(hexId, phantimal.unitId, dest),
        () => ctx.autoPlacePhantimal(phantimal.unitId, dest, kept),
      )
    }
    return { placed, skipped }
  }

  // Closes a batch of placements on a board: re-aligns the phantimal
  // reconciler, so a lineup that deliberately has no phantimal doesn't gain
  // one, and refreshes skill paint, which companion settling leaves stale.
  const finishPlacing = (ctx: GridContext): void => {
    ctx.seedPhantimalBaseline()
    ctx.refreshSkills()
  }

  // Read through the serializer, so a board carries exactly what a saved team
  // would.
  const captureSides = (ctx: GridContext): CapturedSide[] => {
    const state = serializeGridState(
      ctx.grid.getAllTiles(),
      ctx.artifacts.ally,
      ctx.artifacts.enemy,
      undefined,
      ctx.getAttrs,
    )
    return [Team.ALLY, Team.ENEMY].map((team) => ({ team, side: sideLoadBoard(state, team, true) }))
  }

  // Onto a board with no units; each team's artifact slot ends as captured.
  const placeSides = (ctx: GridContext, sides: CapturedSide[]): void => {
    for (const { team, side } of sides) {
      placeSide(ctx, side, team)
      if (side.artifact !== null) ctx.setArtifact(team, side.artifact)
      else ctx.removeArtifact(team)
    }
    finishPlacing(ctx)
  }

  /* Exchange two boards' lineups and artifacts. Every unit keeps its team,
   * its upgrade record and, where the other board's map has it, its tile
   * (placeSide). The target board becomes active. */
  const swapBoards = (sourceId: number, targetId: number): boolean => {
    if (sourceId === targetId) return false
    const source = contexts.value[sourceId]
    const target = contexts.value[targetId]
    if (!source || !target) return false

    const fromSource = captureSides(source)
    const fromTarget = captureSides(target)
    // Clear both before placing so a unit crossing boards never transiently
    // duplicates its pre-swap copy under page-wide per-team uniqueness.
    source.clearCharacters()
    target.clearCharacters()
    placeSides(source, fromTarget)
    placeSides(target, fromSource)

    activeId.value = targetId
    return true
  }

  /* Move a board onto another map with everything on it: each unit keeps its
   * tile where the new map has it (placeSide). False for an unknown map,
   * which leaves the board as it was. */
  const moveToMap = (ctx: GridContext, mapKey: string): boolean => {
    const sides = captureSides(ctx)
    if (!ctx.switchMap(mapKey)) return false
    placeSides(ctx, sides)
    return true
  }

  // Board i onto maps[i]; a board already on its map is left untouched.
  const moveToMaps = (maps: readonly string[]): void => {
    contexts.value.forEach((ctx, i) => {
      const mapKey = maps[i]
      if (mapKey !== undefined && mapKey !== ctx.currentMap) moveToMap(ctx, mapKey)
    })
  }

  // The boards a side-load touches, shared by loadTeamSide and its read-only
  // confirm mirror below so the two can never drift.
  const sideLoadContexts = (scope: SideLoadOptions['scope']): GridContext[] =>
    scope === 'active' ? (active.value ? [active.value] : []) : contexts.value

  // Whether clearTeam would remove anything: a unit or the side's artifact.
  const teamHasContent = (ctx: GridContext, team: Team): boolean =>
    getTilesWithCharactersByTeam(ctx.grid, team).length > 0 ||
    artifactSlot(ctx.artifacts, team) !== null

  // Read-only mirror of clearTeam over the scoped boards (the canDropCharacter
  // pattern): the Load confirm must promise exactly what the load's clear phase
  // removes, and Clear's side choice greys out a side with nothing to remove.
  const sideHasContent = (team: Team, scope: SideLoadOptions['scope']): boolean =>
    sideLoadContexts(scope).some((ctx) => teamHasContent(ctx, team))

  const boardsHaveContent = (): boolean =>
    contexts.value.some((ctx) => [Team.ALLY, Team.ENEMY].some((team) => teamHasContent(ctx, team)))

  /* Stamp a one-sided saved team (lib/teams/sideLoad) onto the live boards:
   * clear the destination side first via clearTeam (the dock's per-team wipe:
   * skill cleanup, companion cascade, artifact), then place each board's side
   * (placeSide). `invert` flips the destination team and 180-rotates every
   * saved hex; scope 'active' targets only the active board (a 1v1 record
   * loaded inside a multi-board mode). The other side, maps, and provenance
   * are untouched. */
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

    for (const { ctx } of targets) ctx.clearTeam(dest)

    let placed = 0
    let skipped = 0
    for (const { ctx, board } of targets) {
      const result = placeSide(ctx, board, dest, invert)
      placed += result.placed
      skipped += result.skipped
      // Per-team artifact uniqueness spans boards; a crafted duplicate drops.
      if (board.artifact !== null && !isArtifactUsed(board.artifact, dest)) {
        ctx.setArtifact(dest, board.artifact)
      }
      finishPlacing(ctx)
    }
    deriveSynergy()
    return { placed, skipped }
  }

  /* Stamp match-import lineups (lib/teams/teamImport) onto the boards of a new
   * team (the page starts one first, so nothing from the previous team is kept
   * or checked against). A board first moves to the map its formation shots
   * show (moveToMap). Each side places as a loaded team does (placeSide):
   * heroes with their upgrade records on the tiles the plan gives them, else
   * on random free ones. A side in `board.formations` re-seeds its phantimal
   * baseline once placed, so it keeps the phantimal its screenshot showed or
   * its review picked, or none; any other side gets the one its lineup
   * qualifies for. A hero with no free tile left, or a hero or artifact
   * already on that team on another board, is skipped and counted. Boards
   * without a screenshot stay empty. */
  const applyLineups = (plan: TeamImportPlan): { placed: number; skipped: number } => {
    const targets = plan.boards.flatMap((board, i) => {
      const ctx = contexts.value[i]
      return board && ctx ? [{ ctx, board }] : []
    })
    let placed = 0
    let skipped = 0
    for (const { ctx, board } of targets) {
      if (board.map !== null && board.map !== ctx.currentMap) moveToMap(ctx, board.map)
      for (const team of [Team.ALLY, Team.ENEMY]) {
        const side = board.sides[team]
        if (!side) continue
        placeSide(ctx, side, team)
        // Heroes are what the import reports; its phantimal and companions are not counted.
        const landed = side.mains.filter(
          ({ unitId }) => findCharacterHex(ctx.grid, unitId, team) !== null,
        ).length
        placed += landed
        skipped += side.mains.length - landed
        if (side.artifact === null) continue
        if (isArtifactUsed(side.artifact, team)) skipped++
        else ctx.setArtifact(team, side.artifact)
      }
      for (const team of board.formations) ctx.seedPhantimalBaseline(team)
      // Companion settling leaves skill paint stale.
      ctx.refreshSkills()
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

    // Picker placement (an occupied target is a replace).
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
    // A hero swapped for a phantimal takes a hero slot the phantimal never
    // held, so the board it lands on must still have one free.
    if (isPhantimalId(residentId) && !isPhantimalId(movingId)) {
      return getAvailableTeamSize(targetCtx.grid, residentTeam) > 0
    }
    if (isPhantimalId(movingId) && !isPhantimalId(residentId)) {
      return getAvailableTeamSize(sourceCtx.grid, sourceTeam) > 0
    }
    return true
  }

  // Resolve a drop onto a board. Picker and same-board drops use the board's own
  // handler (place/move/swap); cross-board drops compose remove + place. All
  // routing-layer validation is canDropCharacter, the same gate the hover cue
  // reads. A successful drop makes the destination board active (active follows
  // interaction, so a picker drop targets the board it just landed on).
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
      if (!ok) return false
      activeId.value = targetCtxId
      // A picker drop lands as the base hero or its synergy copy; the tile says which.
      const placedId = getCharacter(targetCtx.grid, targetHexId)
      const placedTeam = getCharacterTeam(targetCtx.grid, targetHexId)
      if (sourceHexId === undefined && placedId !== undefined && placedTeam !== undefined) {
        applyRosterLevels(targetCtx, placedId, placedTeam)
      }
      return true
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
    perspective,
    synergy,
    deriveSynergy,
    setSynergy,
    hiddenSkills,
    skillRows,
    setSkillsHidden,
    setGridCount,
    setActive,
    getContext,
    findPlacement,
    resolvePick,
    placePick,
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
    moveToMap,
    moveToMaps,
    sideHasContent,
    boardsHaveContent,
    loadTeamSide,
    applyLineups,
    clearAll,
    clearSide,
  }
})
