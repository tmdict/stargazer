/* Per-board grid context: one self-contained arena board.
 *
 * Bundles everything that is "per board" (its Grid, SkillManager, current map,
 * artifact slots) with the values derived from them (layout, team-view crop,
 * pathfinding target maps) and the operations that mutate them
 * (place / remove / move / swap / phantimal / map switch / clear). The single
 * Arena board is the N=1 case; the 5 v 5 page holds five of these.
 *
 * Reactive effects live in a detached effectScope so a board can be torn down
 * (e.g. when the grid count changes) without leaking watchers. Each board owns
 * its own phantimal faction watcher, scoped to its own grid.
 *
 * Global state (hex size, team-view flag) is passed in by useGrids and shared by
 * every board, since all boards render at one size and one set of display flags.
 */

import {
  computed,
  effectScope,
  inject,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'

import {
  canPlaceCharacterOnTeam,
  findCharacterHex,
  findTeamPhantimalHex,
  getCharacter,
  getCharacterCount,
  getCharacterPlacements,
  getCharacterTeam,
  getTilesWithCharacters,
  hasCharacter,
} from '@/lib/characters/character'
import { executeMoveCharacter } from '@/lib/characters/move'
import { isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import {
  countTeamFaction,
  PHANTIMAL_FACTION_REQUIREMENT,
  requiredFactions,
} from '@/lib/characters/phantimalFaction'
import { executeAutoPlaceCharacter, executePlaceCharacter } from '@/lib/characters/place'
import { executeClearAllCharacters, executeRemoveCharacter } from '@/lib/characters/remove'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { Grid, type GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { Layout, POINTY, type Point } from '@/lib/layout'
import { getMapByKey } from '@/lib/maps'
import { getClosestTargetMap } from '@/lib/pathfinding'
import { SkillManager } from '@/lib/skills/skill'
import type { CharacterType } from '@/lib/types/character'
import { FULL_GRID } from '@/lib/types/grid'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { getTeamFromTileState, invertTeam } from '@/utils/tileStateFormatting'

// Crop padding for team view, as multipliers on hexRadius. The top multiplier
// covers the perspective-mode character sprite stretch in the worst case (topmost
// ally hex). Re-tune if GridCharacters' vertical offset / scaleY changes; there
// is no clean closed form due to the compound transforms.
const CHARACTER_TOP_PAD_MULTIPLIER = 2.15
const CHARACTER_BOTTOM_PAD_MULTIPLIER = 0.6
// Horizontal crop is pure margin: character discs and artifact icons sit within
// the hex polygon corners, so no sprite-clearance allowance is needed here.
const CROP_SIDE_PAD_MULTIPLIER = 0.4

export interface ViewBoxBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface GridContextGlobals {
  hexSize: Ref<Point>
  teamView: Ref<boolean>
  inverted: Ref<boolean>
  // Team-view crop shared across boards so they stay the same size; null means
  // each board crops to its own ally extent (the single-board Arena).
  sharedCrop?: Ref<{ minX: number; maxX: number; minY: number; maxY: number } | null>
}

// A reactive board entity (store-like): refs and computeds are unwrapped on
// access, so consumers read `ctx.currentMap` / `ctx.viewBoxBounds` without
// `.value`, and `ctx.grid` is the reactive grid proxy.
export interface GridContext {
  id: number
  grid: Grid
  skillManager: SkillManager
  currentMap: string
  artifacts: { ally: number | null; enemy: number | null }

  // Derived (per board)
  layout: Layout
  visibleHexes: Hex[]
  cropHexes: Hex[]
  viewBoxBounds: ViewBoxBounds
  charactersPlaced: number
  placements: Map<number, number>
  closestEnemyMap: ReturnType<typeof getClosestTargetMap>
  closestAllyMap: ReturnType<typeof getClosestTargetMap>
  skillTargets: ReturnType<SkillManager['getAllSkillTargets']>
  skillLines: ReturnType<SkillManager['getSkillLines']>
  // Page-wide values surfaced on the board for one-stop component access.
  hexScale: number
  teamView: boolean
  inverted: boolean

  // Per-board skill queries (each board has its own SkillManager)
  getColorModifierForCharacter: (characterId: number, team: Team) => string | undefined
  getImageModifierForCharacter: (characterId: number, team: Team) => string | undefined
  getTileColorModifier: (hexId: number) => string[] | undefined
  // A tile's pre-skill state, for serializing the bare map (see getBaseTileState
  // on SkillManager). Lets share/save paths reach it without the skillManager.
  getBaseTileState: (hexId: number, state: number) => number

  // Operations (bound to this board's grid + skillManager)
  place: (hexId: number, characterId: number, team?: Team) => boolean
  remove: (hexId: number) => boolean
  move: (fromHexId: number, toHexId: number, characterId: number) => boolean
  swap: (fromHexId: number, toHexId: number) => boolean
  autoPlace: (characterId: number, team: Team) => boolean
  placePhantimal: (hexId: number, phantimalId: number, team?: Team) => boolean
  autoPlacePhantimal: (phantimalId: number, team: Team) => boolean
  phantimalCanJoinTeam: (phantimalId: number, team: Team) => boolean
  phantimalFactionCount: (phantimalId: number, team: Team) => number
  seedPhantimalBaseline: () => void
  setArtifact: (team: Team, artifactId: number) => void
  removeArtifact: (team: Team) => void
  handleDrop: (
    payload: { character: CharacterType; characterId: number },
    targetHexId: number,
  ) => boolean
  switchMap: (mapKey: string) => boolean
  clearCharacters: () => void
  clearArtifacts: () => void
  clear: () => void

  dispose: () => void
}

export function createGridContext(
  id: number,
  mapKey: string,
  globals: GridContextGlobals,
): GridContext {
  const gameDataStore = useGameDataStore()
  const { hexSize, teamView, inverted, sharedCrop } = globals

  const mapConfig = getMapByKey(mapKey)
  const grid = reactive(new Grid(FULL_GRID, mapConfig)) as Grid
  const skillManager = reactive(
    new SkillManager({
      factionOf: gameDataStore.getCharacterFaction,
      classOf: gameDataStore.getCharacterClass,
    }),
  ) as SkillManager
  grid.skillManager = skillManager

  const currentMap = ref(mapKey)
  const artifacts = { ally: ref<number | null>(null), enemy: ref<number | null>(null) }

  const scope = effectScope(true)

  // Phantimal range is data-driven; seed the static character range map with an
  // entry per on-grid phantimal so it can act as a targeting source.
  const buildUnitRanges = (tiles: GridTile[]): Map<number, number> => {
    const ranges = new Map(gameDataStore.characterRanges)
    for (const tile of tiles) {
      if (tile.characterId !== undefined && isPhantimalId(tile.characterId)) {
        ranges.set(tile.characterId, gameDataStore.getCharacterRange(tile.characterId))
      }
    }
    return ranges
  }

  // A phantimal may only join a team that fields enough of its faction(s).
  // With phantimal data unavailable (unit tests) the rule can't be evaluated and
  // placement is allowed.
  const phantimalCanJoinTeam = (phantimalId: number, team: Team): boolean => {
    const phantimal = gameDataStore.getPhantimalById(phantimalId)
    if (!phantimal) return true
    const factions = requiredFactions(phantimal.name, phantimal.faction)
    const count = countTeamFaction(grid, team, factions, gameDataStore.getCharacterFaction)
    return count >= PHANTIMAL_FACTION_REQUIREMENT
  }

  const phantimalFactionCount = (phantimalId: number, team: Team): number => {
    const phantimal = gameDataStore.getPhantimalById(phantimalId)
    if (!phantimal) return 0
    const factions = requiredFactions(phantimal.name, phantimal.faction)
    return countTeamFaction(grid, team, factions, gameDataStore.getCharacterFaction)
  }

  // The phantimal a team currently qualifies for, or null. With a 5-unit roster
  // at most one faction can reach the requirement, so the first match is
  // unambiguous in normal play.
  const findQualifyingPhantimalId = (team: Team): number | null => {
    for (const phantimal of gameDataStore.phantimals) {
      const factions = requiredFactions(phantimal.name, phantimal.faction)
      const count = countTeamFaction(grid, team, factions, gameDataStore.getCharacterFaction)
      if (count >= PHANTIMAL_FACTION_REQUIREMENT) return toPhantimalId(phantimal.id)
    }
    return null
  }

  // Baseline for edge-triggered auto-placement: the phantimal each team last
  // qualified for. Auto-place fires only on the transition into qualifying, so a
  // manually removed phantimal stays gone while the team keeps its faction count.
  const lastQualifyingPhantimal = new Map<Team, number | null>()

  // Re-align the baseline to the current grid without placing anything. A bulk URL
  // restore applies many characters in one batch, which the watcher would
  // otherwise read as a fresh transition; seeding afterward lets a saved state
  // that deliberately omits its phantimal load without one.
  const seedPhantimalBaseline = (): void => {
    for (const team of [Team.ALLY, Team.ENEMY]) {
      lastQualifyingPhantimal.set(team, findQualifyingPhantimalId(team))
    }
  }

  // Phantimals are capped at one per team: drop the team's current phantimal
  // (unless it's the one being re-placed) before adding another.
  const clearTeamPhantimal = (team: Team, exceptHexId?: number): void => {
    const existing = findTeamPhantimalHex(grid, team)
    if (existing !== null && existing !== exceptHexId) {
      executeRemoveCharacter(grid, skillManager, existing)
    }
  }

  const place = (hexId: number, characterId: number, team: Team = Team.ALLY): boolean =>
    executePlaceCharacter(grid, skillManager, hexId, characterId, team)

  const remove = (hexId: number): boolean => executeRemoveCharacter(grid, skillManager, hexId)

  const move = (fromHexId: number, toHexId: number, characterId: number): boolean =>
    executeMoveCharacter(grid, skillManager, fromHexId, toHexId, characterId)

  const swap = (fromHexId: number, toHexId: number): boolean =>
    executeSwapCharacters(grid, skillManager, fromHexId, toHexId)

  const autoPlace = (characterId: number, team: Team): boolean =>
    executeAutoPlaceCharacter(grid, skillManager, characterId, team)

  const placePhantimal = (hexId: number, phantimalId: number, team: Team = Team.ALLY): boolean => {
    if (!phantimalCanJoinTeam(phantimalId, team)) return false
    clearTeamPhantimal(team, hexId)
    return executePlaceCharacter(grid, skillManager, hexId, phantimalId, team)
  }

  const autoPlacePhantimal = (phantimalId: number, team: Team): boolean => {
    if (!phantimalCanJoinTeam(phantimalId, team)) return false
    clearTeamPhantimal(team)
    return executeAutoPlaceCharacter(grid, skillManager, phantimalId, team)
  }

  // Single-board drop: a grid-source drop moves or swaps; a selection drop
  // validates team capacity then places. Cross-board routing is one level up.
  const handleDrop = (
    payload: { character: CharacterType; characterId: number },
    targetHexId: number,
  ): boolean => {
    const { character, characterId } = payload
    if (character.sourceHexId !== undefined) {
      if (hasCharacter(grid, targetHexId)) {
        return swap(character.sourceHexId, targetHexId)
      }
      // Moving a phantimal onto an empty cell on the other team must keep the
      // one-per-team rule and the destination team's faction requirement.
      if (isPhantimalId(characterId)) {
        const destTeam = getTeamFromTileState(grid.getTileById(targetHexId).state)
        const sourceTeam = getCharacterTeam(grid, character.sourceHexId)
        if (destTeam !== null && destTeam !== sourceTeam) {
          if (!phantimalCanJoinTeam(characterId, destTeam)) return false
          clearTeamPhantimal(destTeam, character.sourceHexId)
        }
      }
      return move(character.sourceHexId, targetHexId, characterId)
    }
    const team = getTeamFromTileState(grid.getTileById(targetHexId).state)
    if (team === null) return false
    if (isPhantimalId(characterId)) {
      return placePhantimal(targetHexId, characterId, team)
    }
    if (!canPlaceCharacterOnTeam(grid, characterId, team)) return false
    return place(targetHexId, characterId, team)
  }

  const setArtifact = (team: Team, artifactId: number): void => {
    if (team === Team.ALLY) artifacts.ally.value = artifactId
    else artifacts.enemy.value = artifactId
  }

  const removeArtifact = (team: Team): void => {
    if (team === Team.ALLY) artifacts.ally.value = null
    else artifacts.enemy.value = null
  }

  // Rebuild the grid for the new map. Object.assign preserves the reactive proxy
  // identity; the skill manager must be re-attached and reset because the rebuilt
  // grid drops it.
  const switchMap = (mapKey: string): boolean => {
    const config = getMapByKey(mapKey)
    if (!config) return false
    Object.assign(grid, new Grid(FULL_GRID, config))
    skillManager.reset()
    grid.skillManager = skillManager
    currentMap.value = mapKey
    return true
  }

  const clearCharacters = (): void => {
    executeClearAllCharacters(grid, skillManager)
  }

  const clearArtifacts = (): void => {
    artifacts.ally.value = null
    artifacts.enemy.value = null
  }

  const clear = (): void => {
    clearCharacters()
    clearArtifacts()
  }

  const ctx = scope.run(() => {
    const layout = computed(() => {
      const scale = hexSize.value.x / 40
      const origin: Point = { x: 300 * scale, y: 300 * scale }
      return new Layout(POINTY, hexSize.value, origin)
    })

    // Team view narrows to the tiles of whichever engine team is shown as ally.
    const visibleHexes = computed<Hex[]>(() => {
      if (!teamView.value) return grid.keys()
      const shownTeam = invertTeam(Team.ALLY, inverted.value)
      return grid
        .getAllTiles()
        .filter((tile) => getTeamFromTileState(tile.state) === shownTeam)
        .map((tile) => tile.hex)
    })

    // The crop must also contain the shown team's artifact host cell: the ghost
    // cell beside hex 1 (ally) or 45 (enemy), which renders in team view and can
    // sit at the formation's edge on maps with a sparse front line.
    const cropHexes = computed<Hex[]>(() => {
      if (!teamView.value) return visibleHexes.value
      const shownTeam = invertTeam(Team.ALLY, inverted.value)
      const [hostId, direction] = shownTeam === Team.ALLY ? [1, 4] : [45, 1]
      try {
        return [...visibleHexes.value, grid.getHexById(hostId).neighbor(direction)]
      } catch {
        return visibleHexes.value
      }
    })

    // Team view crops to the shown team's extent (cropHexes), padded for breathing
    // room on the sides and bottom; the top pad also clears the perspective-mode
    // character sprite stretch.
    const viewBoxBounds = computed<ViewBoxBounds>(() => {
      const scale = hexSize.value.x / 40
      const fullWidth = 600 * scale
      const fullHeight = 600 * scale

      if (!teamView.value || visibleHexes.value.length === 0) {
        return { x: 0, y: 0, width: fullWidth, height: fullHeight }
      }

      const hexRadius = hexSize.value.x
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      const shared = sharedCrop?.value
      if (shared) {
        // Crop every board to the same extent so the row stays even-sized.
        minX = shared.minX
        maxX = shared.maxX
        minY = shared.minY
        maxY = shared.maxY
      } else {
        for (const hex of cropHexes.value) {
          for (const c of layout.value.polygonCorners(hex)) {
            if (c.x < minX) minX = c.x
            if (c.x > maxX) maxX = c.x
            if (c.y < minY) minY = c.y
            if (c.y > maxY) maxY = c.y
          }
        }
      }

      const topPad = hexRadius * CHARACTER_TOP_PAD_MULTIPLIER
      const bottomPad = hexRadius * CHARACTER_BOTTOM_PAD_MULTIPLIER
      const sidePad = hexRadius * CROP_SIDE_PAD_MULTIPLIER
      // y may go negative: the clip wrapper turns a negative y into top padding,
      // which keeps perspective-mode sprites from clipping near the y=0 edge.
      const y = minY - topPad
      const height = maxY - minY + topPad + bottomPad
      const x = minX - sidePad
      const width = maxX - minX + sidePad * 2
      return { x, y, width, height }
    })

    const placements = computed(() => getCharacterPlacements(grid))
    const charactersPlaced = computed(() => getCharacterCount(grid))

    const closestMap = (sourceTeam: Team, targetTeam: Team) =>
      computed(() => {
        const tiles = getTilesWithCharacters(grid)
        const ranges = buildUnitRanges(tiles)
        return getClosestTargetMap(
          tiles,
          sourceTeam,
          targetTeam,
          (hex) => grid.getTileOrUndefined(hex),
          ranges,
        )
      })
    const closestEnemyMap = closestMap(Team.ALLY, Team.ENEMY)
    const closestAllyMap = closestMap(Team.ENEMY, Team.ALLY)

    const hexScale = computed(() => hexSize.value.x / 40)
    const teamViewActive = computed(() => teamView.value)
    const invertedActive = computed(() => inverted.value)

    // Per-board skill-derived data, read by the tile / character / targeting layers.
    const colorModifiers = computed(() => skillManager.getColorModifiersByCharacterAndTeam())
    const imageModifiers = computed(() => skillManager.getImageModifiersByCharacterAndTeam())
    const tileColorModifiers = computed(() => {
      skillManager.getTargetVersion()
      return skillManager.getTileColorModifiers()
    })
    const skillTargets = computed(() => {
      skillManager.getTargetVersion()
      return skillManager.getAllSkillTargets()
    })
    const skillLines = computed(() => {
      skillManager.getTargetVersion()
      return skillManager.getSkillLines()
    })
    const getColorModifierForCharacter = (characterId: number, team: Team): string | undefined =>
      colorModifiers.value.get(`${characterId}-${team}`)
    const getImageModifierForCharacter = (characterId: number, team: Team): string | undefined =>
      imageModifiers.value.get(`${characterId}-${team}`)
    const getTileColorModifier = (hexId: number): string[] | undefined =>
      tileColorModifiers.value.get(hexId)
    const getBaseTileState = (hexId: number, state: number): number =>
      skillManager.getBaseTileState(hexId, state)

    // Reconcile each team's phantimal with its faction count after every
    // placement change:
    //  - Remove an on-field phantimal whose team dropped below the requirement.
    //  - Auto-place a faction's phantimal the moment a team crosses into
    //    qualifying (edge-triggered via lastQualifyingPhantimal), unless it
    //    already has one. Manually removing it leaves the team still qualifying,
    //    so no new transition fires and it stays gone.
    let reconciling = false
    const reconcilePhantimals = (): void => {
      if (reconciling) return
      reconciling = true
      try {
        for (const team of [Team.ALLY, Team.ENEMY]) {
          const phantimalHex = findTeamPhantimalHex(grid, team)
          if (phantimalHex !== null) {
            const phantimalId = getCharacter(grid, phantimalHex)
            if (phantimalId !== undefined && !phantimalCanJoinTeam(phantimalId, team)) {
              executeRemoveCharacter(grid, skillManager, phantimalHex)
            }
          }

          const qualifying = findQualifyingPhantimalId(team)
          const previous = lastQualifyingPhantimal.get(team) ?? null
          if (
            qualifying !== null &&
            qualifying !== previous &&
            findTeamPhantimalHex(grid, team) === null
          ) {
            autoPlacePhantimal(qualifying, team)
          }
          lastQualifyingPhantimal.set(team, qualifying)
        }
      } finally {
        reconciling = false
      }
    }
    watch(placements, reconcilePhantimals, { flush: 'post' })

    return {
      layout,
      visibleHexes,
      cropHexes,
      viewBoxBounds,
      placements,
      charactersPlaced,
      closestEnemyMap,
      closestAllyMap,
      hexScale,
      teamView: teamViewActive,
      inverted: invertedActive,
      skillTargets,
      skillLines,
      getColorModifierForCharacter,
      getImageModifierForCharacter,
      getTileColorModifier,
      getBaseTileState,
    }
  })!

  return reactive({
    id,
    grid,
    skillManager,
    currentMap,
    artifacts,
    ...ctx,
    place,
    remove,
    move,
    swap,
    autoPlace,
    placePhantimal,
    autoPlacePhantimal,
    phantimalCanJoinTeam,
    phantimalFactionCount,
    seedPhantimalBaseline,
    setArtifact,
    removeArtifact,
    handleDrop,
    switchMap,
    clearCharacters,
    clearArtifacts,
    clear,
    dispose: () => scope.stop(),
  }) as GridContext
}

const GridContextKey: InjectionKey<GridContext> = Symbol('gridContext')

export function provideGridContext(ctx: GridContext): void {
  provide(GridContextKey, ctx)
}

export function useGridContext(): GridContext {
  const ctx = inject(GridContextKey)
  if (!ctx) {
    throw new Error('useGridContext must be used within a component that provides a GridContext')
  }
  return ctx
}

// Re-exported so callers building cross-board logic (uniqueness scans) can locate
// a unit on a specific board's grid without importing the character lib directly.
export { findCharacterHex, canPlaceCharacterOnTeam }
