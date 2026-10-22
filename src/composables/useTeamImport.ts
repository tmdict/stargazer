/* Match screenshot import: file intake of result screens, formation panels
 * and replay frames for the tiles, the review state per screenshot, and the
 * plan they make. The import engine (useImportEngine) decodes and reads the
 * screenshots. Module-level state like useSelectionState: the shots belong to
 * one opening of the modal (clearImport), and the modal holds the engine for
 * the page visit, the shots dropped with it when the page is left. */

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
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { isRosterReading } from '@/lib/import/kinds'
import type { CellOverride } from '@/lib/import/review'
import { isFormationReading, type FormationReading } from '@/lib/import/screens/formation/types'
import type { ScreenshotReading, ShotKind } from '@/lib/import/screens/match/types'
import { isReplayReading, type ReplayReading } from '@/lib/import/screens/replay/types'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { withTilePick } from '@/lib/teams/formationImport'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import {
  buildTeamImportPlan,
  formationsSwapped,
  overrideKey,
  type FormationAssignment,
  type PlanInputs,
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

const shots = ref<ImportShot[]>([])
const defaultNames = (): RecordNames => ({ prefix: `S${CURRENT_SEASON}`, left: '', right: '' })
const names = reactive<RecordNames>(defaultNames())
// Swap sides: whether every result screenshot's columns land on the opposite
// board sides. One choice per match (see buildTeamImportPlan), and not a
// reader correction.
const swapSides = ref(false)
let nextId = 1
let namesLoaded = false
// Shots belong to one opening of the modal; clearImport ends it, and an
// addFiles still sorting or decoding for that opening stops adding.
let opening = 0

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
    // Its shots are match screens, whose readers never give a roster's reading.
    if (shot && !isRosterReading(reading)) applyReading(shot, reading)
  },
}

/* `replayMode`: whether replay frames can be read for the boards' type; only
 * Supreme League is fought in the arena they are matched against. */
export function useTeamImport(
  mode: () => TeamModeKey,
  replayMode: () => boolean,
): {
  shots: typeof shots
  referenceStatus: ImportEngine['referenceStatus']
  names: RecordNames
  swapSides: typeof swapSides
  formationSwap: ComputedRef<boolean | null>
  learnedCount: ComputedRef<number>
  plan: ComputedRef<TeamImportPlan>
  unitsOf: (id: string) => TeamImportPlan['units'][number]
  phantimalFits: PlanInputs['phantimalFits']
  // Files of no stated kind ('sort': a paste) go to the section of the kind
  // they show. `onAdd` hears each shot added, before it is read.
  addFiles: (
    files: File[],
    kind: ShotKind | 'sort',
    onAdd?: (id: string) => void,
  ) => Promise<IntakeResult>
  // Files still being sorted and added.
  adding: ImportEngine['adding']
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

  /* End an opening of the modal: drop every shot with its review edits and
   * waiting read, the match's side choice and any unsaved name edits, so the
   * next opening starts fresh. The engine and the learned faces stay for the
   * page visit. */
  const clearImport = (): void => {
    opening++
    for (const shot of shots.value) {
      engine.dropShot(shot.id)
      URL.revokeObjectURL(shot.thumb)
    }
    shots.value = []
    swapSides.value = false
    restoreNames()
  }
  // Leaving the page unmounts the modal, and its shots go with the engine.
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
      replayMode() &&
      shots.value.some((s) => s.kind === 'result') &&
      !shots.value.some((s) => s.kind === 'formation'),
  )
  const formationsClosed = computed(() => shots.value.some((s) => s.kind === 'replay'))

  // Shots refused because their drop is closed, or because they are roster
  // screenshots, are counted by kind, so the caller can say why they were not
  // added. A dropped file is read as the kind of its drop unless the sorter
  // finds a roster screen; a paste goes where the sorter places it, and one it
  // cannot place to the results, or to the formations while those are
  // imported alone.
  const addFiles = (
    files: File[],
    kind: ShotKind | 'sort',
    onAdd?: (id: string) => void,
  ): Promise<IntakeResult> => {
    const mine = opening
    return engine.addFiles(files, {
      current: () => mine === opening,
      replay: () => kind === 'sort' && replayOpen.value,
      place: (sorted): Placement<ShotKind> => {
        if (sorted === 'roster') return { refused: 'roster' }
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
          status: 'reading',
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
  }

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
    // A correction on a cell the reader was unsure about teaches it that
    // face, provided the frame match was trustworthy (else the crop may be
    // off the face). Picking the reader's own top candidate, or no hero,
    // takes back whatever the face was taught before. Lessons come from
    // result screens only, whose card crops the learned store holds.
    if (shot.kind !== 'result' || !cell.paragon.sure || cell.sure) return
    const teach = characterId !== null && cell.candidates[0]?.characterId !== characterId
    engine.learnFace(teach ? characterId : null, cell.descriptor)
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
    // A result shot that failed to read still makes the import a match, as the
    // modal shows it, so formations never fall back to their own upgrades.
    const match = shots.value.some((s) => s.kind === 'result')
    return buildTeamImportPlan(resultAssignments.value, mode(), names, {
      swapSides: swapSides.value,
      formations: formationAssignments.value,
      replays,
      matchImport: match,
      phantimalFits,
    })
  })

  // Who each unit of a formation shot is taken for, from the plan.
  const unitsOf = (id: string): TeamImportPlan['units'][number] => {
    const i = formationShots.value.findIndex((s) => s.id === id)
    return i < 0 ? [] : (plan.value.units[i] ?? [])
  }

  return {
    shots,
    referenceStatus: engine.referenceStatus,
    names,
    swapSides,
    formationSwap,
    learnedCount: engine.learnedCount,
    plan,
    unitsOf,
    phantimalFits,
    addFiles,
    adding: engine.adding,
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
