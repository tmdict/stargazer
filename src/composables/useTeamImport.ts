/* Match screenshot import: file intake of result screens, formation panels
 * and replay frames for the tiles, the review state per screenshot, and the
 * plan they make. The import engine (useImportEngine) decodes and reads the
 * screenshots. Module-level state like useSelectionState: the shots belong to
 * one opening of the modal, and closing it (clearImport) drops them and
 * releases the engine. */

import {
  computed,
  getCurrentScope,
  onScopeDispose,
  reactive,
  ref,
  watch,
  type ComputedRef,
} from 'vue'

import {
  imageToDataUrl,
  useImportEngine,
  type ImportEngine,
  type IntakeResult,
  type Placement,
  type ShotError,
  type ShotSession,
  type ShotStatus,
} from '@/composables/useImportEngine'
import type { PlacingSide } from '@/composables/useTilePlacing'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { frameTrusted } from '@/lib/import/card/frames'
import { isMatchupReading, isRosterReading } from '@/lib/import/kinds'
import type { CellOverride } from '@/lib/import/review'
import { isFormationReading, type FormationReading } from '@/lib/import/screens/formation/types'
import type { ScreenshotReading, ShotKind } from '@/lib/import/screens/match/types'
import { isReplayReading, type ReplayReading } from '@/lib/import/screens/replay/types'
import { DEFAULT_MAP_KEY } from '@/lib/maps'
import { CURRENT_SEASON } from '@/lib/seasonal'
import {
  assignedPortraits,
  fieldableUnits,
  missingUnits,
  replayPlacing,
  withTilePick,
  type UnitAssignment,
} from '@/lib/teams/formationImport'
import { newTeamMaps, TEAM_MODES, type TeamModeKey, type VariantMatch } from '@/lib/teams/modes'
import type { SideLoadBoard } from '@/lib/teams/sideLoad'
import {
  artifactState,
  buildTeamImportPlan,
  formationsSwapped,
  overrideKey,
  reviewStates,
  SIDES,
  type FormationAssignment,
  type RecordNames,
  type ReplayAssignment,
  type ShotAssignment,
  type TeamImportPlan,
} from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { readStorage, writeStorage } from '@/utils/storage'

const NAMES_KEY = 'stargazer.import.names'

// The reading is what the screenshot says; every review decision is an
// override beside it, and what a card shows (its map, its winner, each cell)
// is derived from the two, so a decision made while the shot was still
// reading, or under another mode, is never overwritten or stranded.
export interface ImportShot {
  id: string
  kind: ShotKind
  name: string
  size: number
  // Object URL of the file, for the card thumbnail.
  thumb: string
  status: ShotStatus
  error: ShotError | null
  reading: ScreenshotReading | null
  overrides: Record<string, CellOverride>
  artifactOverrides: Partial<Record<Team, number | null>>
  // The board and winner chosen in review; absent until chosen.
  resultOverrides: { mapIndex?: number | null; winner?: Team | null }
  // Data URLs of each card as located, keyed like overrides.
  cards: Record<string, string>
  artifactCards: Partial<Record<Team, string>>
  // A formation shot's unit picks, by unit index (a unit id, or null for
  // none), and its portraits as data URLs.
  unitOverrides: Record<number, number | null>
  unitCards: string[]
  // By board side, the unit picked for each tile, by hex id: on a replay
  // frame the unit that started there, on a formation shot one its
  // screenshot does not show.
  tilePicks: Partial<Record<Team, Record<number, number>>>
}

/* The board a shot fills among `boardCount`: the reviewer's choice, else the
 * strip's map when the mode has it; a one-board mode has only the one. */
export const shotMapIndex = (shot: ImportShot, boardCount: number): number | null => {
  const chosen = shot.resultOverrides.mapIndex
  const mapIndex =
    chosen !== undefined ? chosen : boardCount === 1 ? 0 : (shot.reading?.mapIndex ?? null)
  return mapIndex !== null && mapIndex < boardCount ? mapIndex : null
}

export const shotWinner = (shot: ImportShot): Team | null =>
  shot.resultOverrides.winner !== undefined
    ? shot.resultOverrides.winner
    : (shot.reading?.winner ?? null)

// Who each portrait of a formation shot is taken for, the units its side can
// field, and the side as the plan places it, on its map.
export interface FormationUnits {
  assignments: readonly UnitAssignment[]
  options: readonly number[]
  placed: { mapKey: string; team: Team; side: SideLoadBoard } | null
}

// A board side of a replay frame: the heroes the plan puts there, and every
// unit it can field.
export interface ReplaySide {
  heroes: readonly number[]
  options: readonly number[]
}

/* The placing of a replay frame's board side: its order and the picks that
 * count. The frame's review places by it and its card counts from it. */
export const replaySidePlacing = (
  shot: ImportShot,
  side: Team,
  { heroes, options }: ReplaySide,
): PlacingSide => ({
  ...replayPlacing(heroes, options, shot.tilePicks[side] ?? {}),
  heroes,
  options,
})

/* The placing of the units a formation shot's side fields and its portraits
 * miss; null with none. The shot's review places by it and its card counts
 * from it. */
export const missingPlacing = (shot: ImportShot, units: FormationUnits): PlacingSide | null => {
  const placed = units.placed
  const reading = shot.reading
  if (!placed || !reading || !isFormationReading(reading)) return null
  const portraits = assignedPortraits(reading.units, units.assignments)
  const lineup = placed.side.mains.map((unit) => unit.unitId)
  const side = missingUnits(lineup, portraits, units.options, shot.tilePicks[placed.team] ?? {})
  if (side.order.length === 0 && side.picks.size === 0) return null
  const heroes = lineup.filter((unitId) => !portraits.some((u) => u.unitId === unitId))
  return { ...side, heroes }
}

const unplaced = ({ order, picks }: PlacingSide): number => {
  const picked = [...picks.values()]
  return order.filter((id) => !picked.includes(id)).length
}

const shots = ref<ImportShot[]>([])
const defaultNames = (): RecordNames => ({ prefix: `S${CURRENT_SEASON}`, left: '', right: '' })
const names = reactive<RecordNames>(defaultNames())
// Swap sides: whether every result screenshot's columns land on the opposite
// board sides. One choice per match (see buildTeamImportPlan), and not a
// reader correction.
const swapSides = ref(false)
let nextId = 1
let namesLoaded = false

const restoreNames = (): void => {
  Object.assign(names, defaultNames())
  try {
    const stored = JSON.parse(readStorage(NAMES_KEY) ?? 'null') as Partial<RecordNames> | null
    if (stored && typeof stored === 'object') {
      if (typeof stored.prefix === 'string') names.prefix = stored.prefix
      if (typeof stored.left === 'string') names.left = stored.left
      if (typeof stored.right === 'string') names.right = stored.right
    }
  } catch {
    // Unreadable names fall back to the defaults.
  }
}

const loadNames = (): void => {
  if (namesLoaded) return
  namesLoaded = true
  restoreNames()
}

const saveNames = (): void => {
  writeStorage(
    NAMES_KEY,
    JSON.stringify({ prefix: names.prefix, left: names.left, right: names.right }),
  )
}

const findShot = (id: string): ImportShot | undefined => shots.value.find((s) => s.id === id)

const applyReading = (shot: ImportShot, reading: ScreenshotReading): void => {
  shot.reading = reading
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const artifact = reading.artifacts[team]
    if (artifact) shot.artifactCards[team] = imageToDataUrl(artifact.card)
    reading.sides[team].forEach((cell, row) => {
      shot.cards[overrideKey(team, row)] = imageToDataUrl(cell.card)
    })
  }
  if (isFormationReading(reading)) shot.unitCards = reading.units.map((u) => imageToDataUrl(u.card))
}

const session: ShotSession = {
  kinds: ['result', 'formation', 'replay'],
  shots: () => shots.value,
  apply: (id, reading) => {
    const shot = findShot(id)
    // Its shots are match screens, whose readers never give a roster's or a
    // matchup list's reading.
    if (shot && !isRosterReading(reading) && !isMatchupReading(reading)) {
      applyReading(shot, reading)
    }
  },
}

/* `variant`: the live boards' type. It names the maps a new team starts on,
 * and replay frames are read for Supreme League alone, the one fought in the
 * arena they are matched against. */
export function useTeamImport(
  mode: () => TeamModeKey,
  variant: () => VariantMatch,
): {
  shots: typeof shots
  referenceStatus: ImportEngine['referenceStatus']
  names: RecordNames
  swapSides: typeof swapSides
  formationSwap: ComputedRef<boolean | null>
  learnedCount: ComputedRef<number>
  plan: ComputedRef<TeamImportPlan>
  mapCount: ComputedRef<number>
  // Result shots make the import a match, whose formation shots only place its
  // heroes; formation shots dropped first are imported alone.
  matchImport: ComputedRef<boolean>
  // Whether the result columns land on the opposite board sides.
  sidesSwapped: ComputedRef<boolean>
  // In a match import, a formation shot or replay frame of a map with no
  // result shot places nothing.
  noResult: (shot: ImportShot) => boolean
  // The map a shot's board stands on; null while it has no board.
  boardMap: (shot: ImportShot) => string | null
  // The sides whose cards a shot's review shows.
  cardSides: (shot: ImportShot) => readonly Team[]
  formationUnits: (shot: ImportShot) => FormationUnits
  replaySides: (shot: ImportShot) => Record<Team, ReplaySide>
  // A shot's board sides as the plan places them; null without a board.
  placedSides: (shot: ImportShot) => Partial<Record<Team, SideLoadBoard>> | null
  // What a shot's card still asks about, as its review shows it: an edit
  // settles its cell, artifact or unit.
  reviewCount: (shot: ImportShot) => number
  // A shot's units still without a tile.
  placeCount: (shot: ImportShot) => number
  // Files of no stated kind ('sort': a paste) go to the section of the kind
  // they show. `onAdd` hears each shot added, before it is read.
  addFiles: (
    files: File[],
    kind: ShotKind | 'sort',
    onAdd?: (id: string) => void,
  ) => Promise<IntakeResult>
  progress: ImportEngine['progress']
  resultsClosed: ComputedRef<boolean>
  formationsClosed: ComputedRef<boolean>
  replayOpen: ComputedRef<boolean>
  removeShot: (id: string) => void
  clearImport: () => void
  setMap: (id: string, mapIndex: number | null) => void
  setWinner: (id: string, winner: Team | null) => void
  setHero: (id: string, team: Team, row: number, characterId: number | null) => void
  setLevel: (
    id: string,
    team: Team,
    row: number,
    field: 'paragon' | 'refinement',
    level: number,
  ) => void
  setArtifact: (id: string, team: Team, artifactId: number | null) => void
  setUnit: (id: string, index: number, unitId: number | null) => void
  setTilePick: (id: string, side: Team, hexId: number, unitId: number | null) => void
  saveNames: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  loadNames()
  const engine = useImportEngine(session)

  const clearImport = (): void => {
    engine.release()
    for (const shot of shots.value) URL.revokeObjectURL(shot.thumb)
    shots.value = []
    swapSides.value = false
    restoreNames()
  }
  if (getCurrentScope()) onScopeDispose(clearImport)

  const boardCount = (): number => TEAM_MODES[mode()].boardCount

  // Formation shots dropped before any result shot are imported alone, and
  // no result shot joins them until they are removed: a formation panel shows
  // the player's own upgrades, never a match's.
  const resultsClosed = computed(
    () =>
      shots.value.some((s) => s.kind === 'formation') &&
      !shots.value.some((s) => s.kind === 'result'),
  )

  // Replay frames place a match's heroes when its formations could not be
  // saved: they are offered once result shots name the lineups and while no
  // formation shot places them, and close the formation drop until removed.
  const replayOpen = computed(
    () =>
      variant() === 'sl' &&
      shots.value.some((s) => s.kind === 'result') &&
      !shots.value.some((s) => s.kind === 'formation'),
  )
  const formationsClosed = computed(() => shots.value.some((s) => s.kind === 'replay'))

  // Shots refused because their drop is closed, or because they are roster or
  // matchup screenshots, are counted by kind, so the caller can say why they
  // were not added. A dropped file is read as the kind of its drop unless the
  // sorter finds a roster or matchup screen; a paste goes where the sorter
  // places it, and one it cannot place to the results, or to the formations
  // while those are imported alone.
  const addFiles = (
    files: File[],
    kind: ShotKind | 'sort',
    onAdd?: (id: string) => void,
  ): Promise<IntakeResult> =>
    engine.addFiles(files, {
      replay: () => kind === 'sort' && replayOpen.value,
      place: (sorted): Placement<ShotKind> => {
        if (sorted === 'roster' || sorted === 'matchup') return { refused: sorted }
        const shotKind =
          kind === 'sort' ? (sorted ?? (resultsClosed.value ? 'formation' : 'result')) : kind
        const closed =
          (shotKind === 'result' && resultsClosed.value) ||
          (shotKind === 'formation' && formationsClosed.value) ||
          (shotKind === 'replay' && !replayOpen.value)
        return closed ? { refused: shotKind } : { kind: shotKind }
      },
      add: (file, shotKind) => {
        const shot = reactive({
          id: `shot-${nextId++}`,
          kind: shotKind,
          name: file.name,
          size: file.size,
          thumb: URL.createObjectURL(file),
          status: 'waiting',
          error: null,
          reading: null,
          overrides: {},
          artifactOverrides: {},
          resultOverrides: {},
          cards: {},
          artifactCards: {},
          unitOverrides: {},
          unitCards: [],
          tilePicks: {},
        }) as ImportShot
        shots.value = [...shots.value, shot]
        onAdd?.(shot.id)
        return shot
      },
    })

  const removeShot = (id: string): void => {
    const shot = findShot(id)
    if (shot) URL.revokeObjectURL(shot.thumb)
    engine.dropShot(id)
    shots.value = shots.value.filter((s) => s.id !== id)
  }

  const setMap = (id: string, mapIndex: number | null): void => {
    const shot = findShot(id)
    if (!shot) return
    const before = shotMapIndex(shot, boardCount())
    shot.resultOverrides.mapIndex = mapIndex
    // A frame's picks are tiles of its old board's map, so another board
    // starts them over.
    if (shot.kind === 'replay' && shotMapIndex(shot, boardCount()) !== before) shot.tilePicks = {}
  }

  const setWinner = (id: string, winner: Team | null): void => {
    const shot = findShot(id)
    if (shot) shot.resultOverrides.winner = winner
  }

  const setHero = (id: string, team: Team, row: number, characterId: number | null): void => {
    const shot = findShot(id)
    const cell = shot?.reading?.sides[team][row]
    if (!shot || !cell) return
    const key = overrideKey(team, row)
    shot.overrides[key] = { ...shot.overrides[key], characterId }
    // Lessons come from result screens only, whose card crops the learned
    // store holds.
    if (shot.kind === 'result' && frameTrusted(cell.paragon)) {
      engine.learnCorrection([cell], characterId)
    }
  }

  const setLevel = (
    id: string,
    team: Team,
    row: number,
    field: 'paragon' | 'refinement',
    level: number,
  ): void => {
    const shot = findShot(id)
    if (!shot) return
    const key = overrideKey(team, row)
    shot.overrides[key] = { ...shot.overrides[key], [field]: level }
  }

  const setArtifact = (id: string, team: Team, artifactId: number | null): void => {
    const shot = findShot(id)
    if (shot) shot.artifactOverrides[team] = artifactId
  }

  const setUnit = (id: string, index: number, unitId: number | null): void => {
    const shot = findShot(id)
    if (shot) shot.unitOverrides[index] = unitId
  }

  const setTilePick = (id: string, side: Team, hexId: number, unitId: number | null): void => {
    const shot = findShot(id)
    if (!shot) return
    shot.tilePicks = {
      ...shot.tilePicks,
      [side]: withTilePick(shot.tilePicks[side] ?? {}, hexId, unitId),
    }
  }

  const formationShots = computed(() =>
    shots.value.filter(
      (s): s is ImportShot & { reading: FormationReading } =>
        s.kind === 'formation' && s.reading !== null && isFormationReading(s.reading),
    ),
  )

  const resultAssignments = computed((): ShotAssignment[] =>
    shots.value
      .filter(
        (s): s is ImportShot & { reading: ScreenshotReading } =>
          s.kind === 'result' && s.reading !== null,
      )
      .map((s) => ({
        reading: s.reading,
        mapIndex: shotMapIndex(s, boardCount()),
        winner: shotWinner(s),
        overrides: s.overrides,
        artifactOverrides: s.artifactOverrides,
      })),
  )
  const formationAssignments = computed((): FormationAssignment[] =>
    formationShots.value.map((s) => ({
      reading: s.reading,
      mapIndex: shotMapIndex(s, boardCount()),
      overrides: s.overrides,
      artifactOverrides: s.artifactOverrides,
      unitOverrides: s.unitOverrides,
      picks: s.tilePicks,
    })),
  )

  const formationSwap = computed(() =>
    formationsSwapped(resultAssignments.value, formationAssignments.value),
  )
  // Each new answer from the formation shots sets Swap sides; a change the
  // user makes stands until the next one.
  watch(formationSwap, (said) => {
    if (said !== null) swapSides.value = said
  })
  // A swap gives every formation shot the other column's lineup, so the
  // portrait corrections made against the old one start over. Tile picks
  // stay, as tiles of the screenshot, and count again for the lineup they
  // were made for once swapped back.
  watch(swapSides, () => {
    for (const shot of shots.value) shot.unitOverrides = {}
  })

  const gameData = useGameDataStore()
  const phantimalFits = (phantimalId: number, heroIds: readonly number[]): boolean =>
    lineupQualifies(gameData.getPhantimalById(phantimalId), heroIds, gameData.getCharacterFaction)

  // A result shot that failed to read still makes the import a match, so
  // formations never fall back to their own upgrades.
  const matchImport = computed(() => shots.value.some((s) => s.kind === 'result'))
  // Formation shots alone have no result columns to swap, whatever the toggle
  // held before their results were removed.
  const sidesSwapped = computed(() => matchImport.value && swapSides.value)

  const plan = computed<TeamImportPlan>(() => {
    // A frame the arena was not found in has no board to place, and its card
    // says so.
    const replays: ReplayAssignment[] = shots.value
      .filter(
        (s): s is ImportShot & { reading: ReplayReading } =>
          s.kind === 'replay' &&
          s.reading !== null &&
          isReplayReading(s.reading) &&
          s.reading.placement !== null,
      )
      .map((s) => ({ mapIndex: shotMapIndex(s, boardCount()), picks: s.tilePicks }))
    return buildTeamImportPlan(resultAssignments.value, mode(), names, {
      swapSides: swapSides.value,
      formations: formationAssignments.value,
      replays,
      matchImport: matchImport.value,
      phantimalFits,
    })
  })

  // ---- Each shot against the plan ----

  const mapIndexOf = (shot: ImportShot): number | null => shotMapIndex(shot, boardCount())

  const noResult = (shot: ImportShot): boolean => {
    if (!matchImport.value) return false
    const mapIndex = mapIndexOf(shot)
    return !shots.value.some((s) => s.kind === 'result' && mapIndexOf(s) === mapIndex)
  }

  // The map its formation shots name, else the new team's for that board.
  const boardMap = (shot: ImportShot): string | null => {
    const mapIndex = mapIndexOf(shot)
    return mapIndex === null
      ? null
      : (plan.value.boards[mapIndex]?.map ?? newTeamMaps(mode(), variant())[mapIndex] ?? null)
  }

  const boardHeroes = (mapIndex: number | null, side: Team | null): number[] =>
    mapIndex === null || side === null
      ? []
      : (plan.value.boards[mapIndex]?.sides[side]?.mains.map((unit) => unit.unitId) ?? [])

  const fieldable = (heroes: readonly number[]): number[] =>
    fieldableUnits(
      heroes,
      gameData.phantimals.map(({ id }) => toPhantimalId(id)),
      (id) => phantimalFits(id, heroes),
    )

  // The board side a formation shot fills: the half its team fought from,
  // swapped or not.
  const formationSide = (shot: ImportShot): Team | null =>
    shot.reading && isFormationReading(shot.reading) ? shot.reading.side : null

  // A formation shot's own cards give the lineup only when imported alone.
  const cardSides = (shot: ImportShot): readonly Team[] => {
    if (shot.kind !== 'formation') return SIDES
    const side = formationSide(shot)
    return side === null || matchImport.value ? [] : [side]
  }

  // Who each unit of a formation shot is taken for, from the plan.
  const unitsOf = (id: string): TeamImportPlan['units'][number] => {
    const i = formationShots.value.findIndex((s) => s.id === id)
    return i < 0 ? [] : (plan.value.units[i] ?? [])
  }

  const placedSide = (shot: ImportShot): FormationUnits['placed'] => {
    const mapIndex = mapIndexOf(shot)
    const team = formationSide(shot)
    if (mapIndex === null || team === null) return null
    const side = plan.value.boards[mapIndex]?.sides[team]
    return side ? { mapKey: boardMap(shot) ?? DEFAULT_MAP_KEY, team, side } : null
  }

  const formationUnits = (shot: ImportShot): FormationUnits => ({
    assignments: unitsOf(shot.id),
    options: fieldable(boardHeroes(mapIndexOf(shot), formationSide(shot))),
    placed: placedSide(shot),
  })

  const replaySides = (shot: ImportShot): Record<Team, ReplaySide> => {
    const side = (team: Team): ReplaySide => {
      const heroes = boardHeroes(mapIndexOf(shot), team)
      return { heroes, options: fieldable(heroes) }
    }
    return { [Team.ALLY]: side(Team.ALLY), [Team.ENEMY]: side(Team.ENEMY) }
  }

  const placedSides = (shot: ImportShot): Partial<Record<Team, SideLoadBoard>> | null => {
    const mapIndex = mapIndexOf(shot)
    return (mapIndex === null ? null : plan.value.boards[mapIndex]?.sides) ?? null
  }

  const reviewCount = (shot: ImportShot): number => {
    const reading = shot.reading
    if (!reading) return 0
    const units =
      shot.kind === 'formation' ? unitsOf(shot.id).filter((u) => u.state !== 'sure').length : 0
    return cardSides(shot).reduce(
      (n, side) =>
        n +
        reviewStates(reading, side, shot.overrides).filter((st) => st !== 'sure').length +
        (artifactState(reading, side, shot.artifactOverrides) === 'review' ? 1 : 0),
      units,
    )
  }

  const placeCount = (shot: ImportShot): number => {
    if (shot.kind === 'formation') {
      const missing = missingPlacing(shot, formationUnits(shot))
      return missing ? unplaced(missing) : 0
    }
    if (shot.kind !== 'replay') return 0
    const sides = replaySides(shot)
    return SIDES.reduce((n, side) => n + unplaced(replaySidePlacing(shot, side, sides[side])), 0)
  }

  return {
    shots,
    referenceStatus: engine.referenceStatus,
    names,
    swapSides,
    formationSwap,
    learnedCount: engine.learnedCount,
    plan,
    mapCount: computed(boardCount),
    matchImport,
    sidesSwapped,
    noResult,
    boardMap,
    cardSides,
    formationUnits,
    replaySides,
    placedSides,
    reviewCount,
    placeCount,
    addFiles,
    progress: engine.progress,
    resultsClosed,
    formationsClosed,
    replayOpen,
    removeShot,
    clearImport,
    setMap,
    setWinner,
    setHero,
    setLevel,
    setArtifact,
    setUnit,
    setTilePick,
    saveNames,
    forgetLearned: engine.forgetLearned,
    ensureReferences: engine.ensureReferences,
  }
}
