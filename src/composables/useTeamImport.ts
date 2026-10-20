/* Match screenshot import: file intake, decoding, the worker that reads the
 * screenshots (result screens, formation panels and replay frames for the
 * tiles), a second one that sorts pastes, the reference images they need, and
 * the review state per screenshot.
 * Module-level state like useSelectionState: the shots belong to one opening
 * of the modal (clearImport), the worker and its references to the page visit
 * (TeamsView disposes them on leave), and the learned faces stay in storage.
 * Images never leave the device: the references are fetched, the screenshots
 * are drawn to a canvas and handed to the worker as pixels. */

import { computed, reactive, ref, shallowRef, watch, type ComputedRef } from 'vue'

import arenaUrl from '@/assets/import/replay-arena.png'
import { isBaseHeroId } from '@/lib/characters/character'
import { companionImages } from '@/lib/characters/companion'
import { inPhantimalBand, toPhantimalId } from '@/lib/characters/phantimal'
import { FIT_WIDTH } from '@/lib/import/board'
import { FRAME_NAMES } from '@/lib/import/frames'
import { FORMATION_MAX_WIDTH, FORMATION_MIN_WIDTH, RESULT_MAX_WIDTH } from '@/lib/import/layout'
import {
  addLearnedIcon,
  dropLearnedIcon,
  parseLearnedIcons,
  serializeLearnedIcons,
} from '@/lib/import/learned'
import {
  isFormationReading,
  isReplayReading,
  type FormationReading,
  type LearnedIcon,
  type PortraitRef,
  type ReplayReading,
  type RgbaImage,
  type ScreenshotReading,
  type ShotKind,
} from '@/lib/import/types'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import {
  buildTeamImportPlan,
  formationsSwapped,
  overrideKey,
  type CellOverride,
  type FormationAssignment,
  type RecordNames,
  type ReplayAssignment,
  type ShotAssignment,
  type TeamImportPlan,
} from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import {
  importReferenceUrl,
  importSkinsManifestUrl,
  isRemoteArtifact,
  phantimalImageUrl,
  seasonArtifactImageUrl,
} from '@/utils/artifactImage'
import { loadMatcherPortraits } from '@/utils/dataLoader'
import { readStorage, writeStorage } from '@/utils/storage'
import type {
  ReferenceImages,
  TeamImportRequest,
  TeamImportResponse,
} from '@/workers/teamImport.worker'

const NAMES_KEY = 'stargazer.import.names'
const LEARNED_KEY = 'stargazer.import.learned'

export type ShotStatus = 'reading' | 'ready' | 'failed'
// Why a shot failed: its file, the references (not loaded, or the worker
// itself did not start), or the reading throwing on it.
export type ShotError = 'too-small' | 'unsupported' | 'references' | 'worker' | 'read'

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

export type ReferenceStatus = 'idle' | 'loading' | 'ready' | 'failed'

const shots = ref<ImportShot[]>([])
const referenceStatus = ref<ReferenceStatus>('idle')
const defaultNames = (): RecordNames => ({ prefix: `S${CURRENT_SEASON}`, left: '', right: '' })
const names = reactive<RecordNames>(defaultNames())
// Swap sides: whether every result screenshot's columns land on the opposite
// board sides. The formation shots set it when they tell, and the user can
// change it. One choice per match (see buildTeamImportPlan), and not a reader
// correction.
const swapSides = ref(false)
// Shallow, and only ever replaced: the list is posted to the worker as is,
// and a reactive proxy cannot be structured-cloned.
const learned = shallowRef<LearnedIcon[]>([])
let worker: Worker | null = null
// A second worker of the same kind sorts pasted screenshots, so a paste is
// sorted at once even while the first is busy reading. It is ready once it
// holds the arena that tells a replay frame.
let sorter: Promise<Worker> | null = null
// The arena picture, fetched once and copied to each worker.
let arena: Promise<RgbaImage> | null = null
const sorting = new Map<string, (kind: ShotKind | null) => void>()
let nextId = 1
let storedLoaded = false
// A page visit is one session. Work still in flight from an earlier one (a
// decode, a reference fetch) checks this before touching the current state.
let session = 0
// Shots belong to one opening of the modal; clearImport ends it, and an
// addFiles still sorting or decoding for that opening stops adding.
let opening = 0
// Decoded shots waiting on the worker, by shot id.
const pending = new Map<string, { image: RgbaImage; kind: ShotKind }>()

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

const loadStored = (): void => {
  if (storedLoaded) return
  storedLoaded = true
  restoreNames()
  learned.value = parseLearnedIcons(readStorage(LEARNED_KEY))
}

const saveNames = (): void => {
  writeStorage(
    NAMES_KEY,
    JSON.stringify({ prefix: names.prefix, left: names.left, right: names.right }),
  )
}

const findShot = (id: string): ImportShot | undefined => shots.value.find((s) => s.id === id)

const failReadingShots = (error: ShotError): void => {
  for (const shot of shots.value) {
    if (shot.status === 'reading') {
      shot.status = 'failed'
      shot.error = error
    }
  }
}

// ---------- image decoding (main thread) ----------

const drawToImage = (source: ImageBitmap, width: number, height: number): RgbaImage => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(source, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height)
  return { width, height, data: data.data }
}

const fetchImage = async (url: string, maxWidth?: number): Promise<RgbaImage> => {
  const response = await fetch(url, { mode: 'cors' })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob())
  try {
    const scale = maxWidth && bitmap.width > maxWidth ? maxWidth / bitmap.width : 1
    return drawToImage(bitmap, Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))
  } finally {
    bitmap.close()
  }
}

// A failed fetch is forgotten, so the next open tries again.
const loadArena = (): Promise<RgbaImage> =>
  (arena ??= fetchImage(arenaUrl).catch((error: unknown) => {
    arena = null
    throw error
  }))

const copyImage = (image: RgbaImage): RgbaImage => ({ ...image, data: image.data.slice() })

const imageToDataUrl = (image: RgbaImage): string => {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  // RgbaImage admits any ArrayBufferLike behind its pixels; ImageData wants a
  // plain ArrayBuffer, so they are copied into one.
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  )
  return canvas.toDataURL('image/jpeg', 0.85)
}

// ---------- references and the worker ----------

// Costume references from the image host, or none when the manifest is missing; a
// single file that fails to load is skipped, the rest still count.
const loadCostumes = async (idOf: (slug: string) => number | undefined): Promise<PortraitRef[]> => {
  let manifest: Record<string, string[]>
  try {
    const response = await fetch(importSkinsManifestUrl(), { mode: 'cors' })
    if (!response.ok) return []
    manifest = (await response.json()) as Record<string, string[]>
  } catch {
    return []
  }
  const jobs: Promise<PortraitRef | null>[] = []
  for (const [slug, files] of Object.entries(manifest)) {
    const characterId = idOf(slug)
    if (characterId === undefined || !Array.isArray(files)) continue
    for (const file of files) {
      jobs.push(
        fetchImage(importReferenceUrl(`skin/${file}`))
          .then((image) => ({ characterId, image, costume: true }))
          .catch(() => null),
      )
    }
  }
  return (await Promise.all(jobs)).filter((ref): ref is PortraitRef => ref !== null)
}

async function loadReferences(): Promise<ReferenceImages> {
  const gameData = useGameDataStore()
  const portraitLoaders = loadMatcherPortraits()
  const heroes = gameData.characters.filter(
    (c) => isBaseHeroId(c.id) && !c.placeholder && portraitLoaders[c.name],
  )
  const ids = new Map(gameData.characters.map((c) => [c.name, c.id]))
  const [portraits, costumes] = await Promise.all([
    Promise.all(
      heroes.map(async (hero) => ({
        characterId: hero.id,
        image: await fetchImage(await portraitLoaders[hero.name]!()),
      })),
    ),
    loadCostumes((slug) => ids.get(slug)),
  ])
  const frames = await Promise.all(
    FRAME_NAMES.map((name) => fetchImage(importReferenceUrl(`frame-${name}`))),
  )
  // An icon that fails to load is skipped like a costume: the frames are the
  // only references the reading cannot do without.
  const artifacts = (
    await Promise.all(
      gameData.artifacts.map((artifact) =>
        fetchImage(
          isRemoteArtifact(artifact.season)
            ? seasonArtifactImageUrl(artifact.name)
            : gameData.getArtifactImage(artifact.name),
          128,
        )
          .then((image) => ({ artifactId: artifact.id, image }))
          .catch(() => null),
      ),
    )
  ).filter((ref): ref is ReferenceImages['artifacts'][number] => ref !== null)
  // Phantimals and the companions drawn with art of their own, for the units
  // standing on a formation board; one that fails to load is skipped.
  const units = (
    await Promise.all(
      [
        ...gameData.phantimals.map(({ id, name }) =>
          fetchImage(phantimalImageUrl(name)).then((image) => ({
            characterId: toPhantimalId(id),
            image,
          })),
        ),
        ...companionImages().map(async ({ unitId, image }) => ({
          characterId: unitId,
          image: await fetchImage(
            inPhantimalBand(unitId) ? phantimalImageUrl(image) : await portraitLoaders[image]!(),
          ),
        })),
      ].map((job) => job.catch(() => null)),
    )
  ).filter((ref): ref is PortraitRef => ref !== null)
  return {
    frames,
    portraits: [...portraits, ...costumes],
    artifacts,
    units,
    learned: learned.value,
    // Only replay frames need the arena, so the rest read without it.
    arena: await loadArena().then(copyImage, () => null),
  }
}

const post = (message: TeamImportRequest, transfer: Transferable[] = []): void => {
  worker?.postMessage(message, transfer)
}

const applyReading = (shot: ImportShot, reading: ScreenshotReading): void => {
  shot.reading = reading
  shot.status = 'ready'
  shot.error = null
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const artifact = reading.artifacts[team]
    if (artifact) shot.artifactCards[team] = imageToDataUrl(artifact.card)
    reading.sides[team].forEach((cell, row) => {
      shot.cards[overrideKey(team, row)] = imageToDataUrl(cell.card)
    })
  }
  if (isFormationReading(reading)) shot.unitCards = reading.units.map((u) => imageToDataUrl(u.card))
}

const onMessage = (event: MessageEvent<TeamImportResponse>): void => {
  const msg = event.data
  if (msg.type === 'ready') {
    referenceStatus.value = 'ready'
    for (const [id, { image, kind }] of pending) {
      const shot = findShot(id)
      if (!shot) continue
      // Includes shots failed by an earlier reference load; this one reads them.
      shot.status = 'reading'
      shot.error = null
      post({ type: 'read', id, image, kind }, [image.data.buffer])
    }
    pending.clear()
    return
  }
  if (msg.type === 'error') {
    if (msg.id === null) {
      // The reference tables themselves failed to build.
      console.error('Match import references failed', msg.message)
      referenceStatus.value = 'failed'
      failReadingShots('references')
      return
    }
    const shot = findShot(msg.id)
    if (!shot) return
    console.error(`Match import could not read ${shot.name}`, msg.message)
    shot.status = 'failed'
    shot.error = 'read'
    return
  }
  // Sorting is the second worker's.
  if (msg.type !== 'reading') return
  const shot = findShot(msg.id)
  if (shot) applyReading(shot, msg.reading)
}

const startSorter = async (): Promise<Worker> => {
  const started = new Worker(new URL('../workers/teamImport.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = (event: MessageEvent<TeamImportResponse>) => {
    const msg = event.data
    if (msg.type !== 'sorted' && msg.type !== 'error') return
    if (msg.id === null) return
    const done = sorting.get(msg.id)
    if (!done) return
    sorting.delete(msg.id)
    done(msg.type === 'sorted' ? msg.kind : null)
  }
  started.onerror = () => {
    started.terminate()
    sorter = null
    for (const done of sorting.values()) done(null)
    sorting.clear()
  }
  try {
    const image = copyImage(await loadArena())
    const message: TeamImportRequest = { type: 'arena', image }
    started.postMessage(message, [image.data.buffer])
  } catch {
    // Pastes are still sorted between formations and results.
  }
  return started
}

/* Which kind a screenshot is, for one that came with none (a paste); null
   when it cannot be told, and the caller's default stands. A replay frame is
   only told when `replay` allows one. */
const sortShot = async (file: Blob, replay: boolean): Promise<ShotKind | null> => {
  const mine = session
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let image: RgbaImage
  try {
    // The board fit reads a copy this wide, so the sort needs no more; a
    // result screen too small for its tabs at it still lands in the default.
    const width = Math.min(bitmap.width, FIT_WIDTH)
    image = drawToImage(bitmap, width, Math.round((bitmap.height * width) / bitmap.width))
  } finally {
    bitmap.close()
  }
  // The page was left meanwhile: no sorter is started for it.
  if (mine !== session) return null
  const started = (sorter ??= startSorter())
  const target = await started
  // The sorter failed while starting, and its error answered the sorts it had.
  if (sorter !== started) return null
  const id = `sort-${nextId++}`
  return new Promise((resolve) => {
    sorting.set(id, resolve)
    const message: TeamImportRequest = { type: 'sort', id, image, replay }
    target.postMessage(message, [image.data.buffer])
  })
}

const startWorker = (): Worker => {
  const started = new Worker(new URL('../workers/teamImport.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = onMessage
  // A worker that fails to start is dropped, so the next attempt gets a fresh one.
  started.onerror = () => {
    started.terminate()
    worker = null
    referenceStatus.value = 'failed'
    failReadingShots('worker')
  }
  return started
}

async function ensureReferences(): Promise<void> {
  if (referenceStatus.value === 'ready' || referenceStatus.value === 'loading') return
  referenceStatus.value = 'loading'
  const mine = session
  try {
    worker ??= startWorker()
    const refs = await loadReferences()
    if (mine !== session) return
    const transfer = [
      ...refs.frames.map((f) => f.data.buffer),
      ...refs.portraits.map((p) => p.image.data.buffer),
      ...refs.artifacts.map((a) => a.image.data.buffer),
      ...refs.units.map((u) => u.image.data.buffer),
      ...(refs.arena ? [refs.arena.data.buffer] : []),
    ]
    post({ type: 'references', ...refs }, transfer)
  } catch (error) {
    if (mine !== session) return
    // Left in the console: the modal only says the references failed, and
    // the failing URL is what a bug report needs.
    console.error('Match import references failed to load', error)
    referenceStatus.value = 'failed'
    failReadingShots('references')
  }
}

// ---------- shots ----------

const decodeShot = async (file: Blob, kind: ShotKind): Promise<RgbaImage> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (bitmap.width < (kind === 'formation' ? FORMATION_MIN_WIDTH : 600)) {
      throw new Error('too small')
    }
    const width = Math.min(
      bitmap.width,
      kind === 'formation' ? FORMATION_MAX_WIDTH : RESULT_MAX_WIDTH,
    )
    return drawToImage(bitmap, width, Math.round((bitmap.height * width) / bitmap.width))
  } finally {
    bitmap.close()
  }
}

// Decode a shot and hand it to the worker, or queue it until the references
// are ready. With the references failed the shot fails too, but its pixels
// stay queued for the retry the next added shot makes in this opening.
const readShot = async (shot: ImportShot, file: Blob): Promise<void> => {
  const mine = session
  try {
    const image = await decodeShot(file, shot.kind)
    if (mine !== session || !findShot(shot.id)) return
    if (referenceStatus.value === 'ready') {
      post({ type: 'read', id: shot.id, image, kind: shot.kind }, [image.data.buffer])
      return
    }
    pending.set(shot.id, { image, kind: shot.kind })
    if (referenceStatus.value === 'failed') {
      shot.status = 'failed'
      shot.error = 'references'
    }
  } catch (error) {
    if (mine !== session || !findShot(shot.id)) return
    shot.status = 'failed'
    shot.error =
      error instanceof Error && error.message === 'too small' ? 'too-small' : 'unsupported'
  }
}

/* End an opening of the modal: drop every shot with its review edits, the
 * match's side choice and any unsaved name edits, so the next opening starts
 * fresh. The worker, its references and the learned faces stay for the page
 * visit. */
const clearImport = (): void => {
  opening++
  pending.clear()
  for (const shot of shots.value) URL.revokeObjectURL(shot.thumb)
  shots.value = []
  swapSides.value = false
  restoreNames()
}

/* `replayMode`: whether replay frames can be read for the boards' type; only
 * Supreme League is fought in the arena they are matched against. */
export function useTeamImport(
  mode: () => TeamModeKey,
  replayMode: () => boolean,
): {
  shots: typeof shots
  referenceStatus: typeof referenceStatus
  names: RecordNames
  swapSides: typeof swapSides
  formationSwap: ComputedRef<boolean | null>
  learnedCount: ComputedRef<number>
  plan: ComputedRef<TeamImportPlan>
  unitsOf: (id: string) => TeamImportPlan['units'][number]
  // Files of no stated kind ('sort': a paste) are sorted by what they show.
  addFiles: (
    files: File[],
    kind: ShotKind | 'sort',
  ) => Promise<{ added: number; refused: Partial<Record<ShotKind, number>> }>
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
  loadStored()

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

  // Shots refused because their drop is closed are counted by kind, so the
  // caller can say why they were not added.
  const addFiles = async (
    files: File[],
    kind: ShotKind | 'sort',
  ): Promise<{ added: number; refused: Partial<Record<ShotKind, number>> }> => {
    void ensureReferences()
    const mine = opening
    let added = 0
    const refused: Partial<Record<ShotKind, number>> = {}
    for (const file of files) {
      if (mine !== opening) break
      if (shots.value.some((s) => s.name === file.name && s.size === file.size)) continue
      const sorted =
        kind === 'sort' ? await sortShot(file, replayOpen.value).catch(() => null) : kind
      if (mine !== opening) break
      const shotKind = sorted ?? (resultsClosed.value ? 'formation' : 'result')
      const closed =
        (shotKind === 'result' && resultsClosed.value) ||
        (shotKind === 'formation' && formationsClosed.value) ||
        (shotKind === 'replay' && !replayOpen.value)
      if (closed) {
        refused[shotKind] = (refused[shotKind] ?? 0) + 1
        continue
      }
      const shot: ImportShot = reactive({
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
      added++
      await readShot(shot, file)
    }
    return { added, refused }
  }

  const removeShot = (id: string): void => {
    const shot = findShot(id)
    if (shot) URL.revokeObjectURL(shot.thumb)
    pending.delete(id)
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
    const next = teach
      ? addLearnedIcon(learned.value, characterId, cell.descriptor, Date.now())
      : dropLearnedIcon(learned.value, cell.descriptor)
    if (!teach && next.length === learned.value.length) return
    learned.value = next
    writeStorage(LEARNED_KEY, serializeLearnedIcons(learned.value))
    post({ type: 'learned', learned: learned.value })
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

  // A unit starts on one tile, so picking it for a tile takes it off any other.
  const setTilePick = (id: string, side: Team, hexId: number, unitId: number | null): void => {
    const shot = findShot(id)
    if (!shot) return
    const picks = Object.fromEntries(
      Object.entries(shot.tilePicks[side] ?? {}).filter(
        ([hex, picked]) => Number(hex) !== hexId && picked !== unitId,
      ),
    )
    if (unitId !== null) picks[hexId] = unitId
    shot.tilePicks = { ...shot.tilePicks, [side]: picks }
  }

  const forgetLearned = (): void => {
    learned.value = []
    writeStorage(LEARNED_KEY, serializeLearnedIcons([]))
    post({ type: 'learned', learned: [] })
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
    return buildTeamImportPlan(
      resultAssignments.value,
      mode(),
      names,
      swapSides.value,
      formationAssignments.value,
      replays,
      match,
    )
  })

  // Who each unit of a formation shot is taken for, from the plan.
  const unitsOf = (id: string): TeamImportPlan['units'][number] => {
    const i = formationShots.value.findIndex((s) => s.id === id)
    return i < 0 ? [] : (plan.value.units[i] ?? [])
  }

  return {
    shots,
    referenceStatus,
    names,
    swapSides,
    formationSwap,
    learnedCount: computed(() => learned.value.length),
    plan,
    unitsOf,
    addFiles,
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
    forgetLearned,
    ensureReferences,
  }
}

/* Drop the worker and the shots when the Teams page is left. */
export function disposeTeamImport(): void {
  session++
  worker?.terminate()
  worker = null
  void sorter?.then((w) => w.terminate())
  sorter = null
  for (const done of sorting.values()) done(null)
  sorting.clear()
  clearImport()
  referenceStatus.value = 'idle'
}
