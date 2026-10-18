/* Match screenshot import: file intake, decoding, the worker that reads the
 * screenshots (result screens, and formation panels for the tiles), the
 * reference images it needs, and the review state per screenshot. Module-level state like useSelectionState, so the modal can be
 * closed and reopened without losing the shots; Save as New drops them once
 * the plan is handed up, and TeamsView disposes everything on leave. Images
 * never leave the device: the references are fetched, the screenshots are
 * drawn to a canvas and handed to the worker as pixels. */

import { computed, reactive, ref, shallowRef, type ComputedRef } from 'vue'

import { isBaseHeroId } from '@/lib/characters/character'
import { companionImages } from '@/lib/characters/companion'
import { inPhantimalBand, toPhantimalId } from '@/lib/characters/phantimal'
import { FRAME_NAMES } from '@/lib/import/frames'
import { CANONICAL_WIDTH, RESULT_MAX_WIDTH } from '@/lib/import/layout'
import {
  addLearnedIcon,
  dropLearnedIcon,
  learnedIconEnvelope,
  parseLearnedIcons,
  serializeLearnedIcons,
} from '@/lib/import/learned'
import {
  isFormationReading,
  type FormationReading,
  type LearnedIcon,
  type PortraitRef,
  type RgbaImage,
  type ScreenshotReading,
} from '@/lib/import/types'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import {
  buildTeamImportPlan,
  overrideKey,
  type CellOverride,
  type FormationAssignment,
  type RecordNames,
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
  ShotKind,
  TeamImportRequest,
  TeamImportResponse,
} from '@/workers/teamImport.worker'

export type { ShotKind }

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
const names = reactive<RecordNames>({ prefix: `S${CURRENT_SEASON}`, left: '', right: '' })
// Whether every screenshot's columns land on the opposite board sides: one
// choice per match (see buildTeamImportPlan), and not a reader correction.
const swapSides = ref(false)
// Shallow, and only ever replaced: the list is posted to the worker as is,
// and a reactive proxy cannot be structured-cloned.
const learned = shallowRef<LearnedIcon[]>([])
let worker: Worker | null = null
// A second worker of the same kind sorts pasted screenshots, so a paste is
// sorted at once even while the first is busy reading.
let sorter: Worker | null = null
const sorting = new Map<string, (kind: ShotKind | null) => void>()
let nextId = 1
let namesLoaded = false
// A page visit is one session. Work still in flight from an earlier one (a
// decode, a reference fetch) checks this before touching the current state.
let session = 0
// Decoded shots waiting on the worker, by shot id.
const pending = new Map<string, { image: RgbaImage; kind: ShotKind }>()

const loadNames = (): void => {
  if (namesLoaded) return
  namesLoaded = true
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

// The board fit reads a copy this wide, so the sort needs no more.
const SORT_WIDTH = 480

const startSorter = (): Worker => {
  const started = new Worker(new URL('../workers/teamImport.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = (event: MessageEvent<TeamImportResponse>) => {
    const msg = event.data
    if (msg.type !== 'sorted' && msg.type !== 'error') return
    const done = msg.id === null ? undefined : sorting.get(msg.id)
    if (!done || msg.id === null) return
    sorting.delete(msg.id)
    done(msg.type === 'sorted' ? msg.kind : null)
  }
  started.onerror = () => {
    started.terminate()
    sorter = null
    for (const done of sorting.values()) done(null)
    sorting.clear()
  }
  return started
}

/* Which kind a screenshot is, for one that came with none (a paste); null
   when it cannot be told, and the caller's default stands. */
const sortShot = async (file: Blob): Promise<ShotKind | null> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let image: RgbaImage
  try {
    const width = Math.min(bitmap.width, SORT_WIDTH)
    image = drawToImage(bitmap, width, Math.round((bitmap.height * width) / bitmap.width))
  } finally {
    bitmap.close()
  }
  const target = (sorter ??= startSorter())
  const id = `sort-${nextId++}`
  return new Promise((resolve) => {
    sorting.set(id, resolve)
    const message: TeamImportRequest = { type: 'sort', id, image }
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

// A formation shot is read at its own size, which the board fit measures, up
// to a width that keeps a full-resolution phone capture quick to read.
const FORMATION_MAX_WIDTH = 1200
const FORMATION_MIN_WIDTH = 400

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
// stay queued for the retry a later open makes.
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

// Drop every shot and the match's side choice; the worker and its references
// stay for the next import.
const clearShots = (): void => {
  pending.clear()
  for (const shot of shots.value) URL.revokeObjectURL(shot.thumb)
  shots.value = []
  swapSides.value = false
}

export function useTeamImport(mode: () => TeamModeKey): {
  shots: typeof shots
  referenceStatus: typeof referenceStatus
  names: RecordNames
  swapSides: typeof swapSides
  learnedCount: ComputedRef<number>
  hasCorrections: ComputedRef<boolean>
  exportCorrections: () => Promise<string>
  plan: ComputedRef<TeamImportPlan>
  unitsOf: (id: string) => TeamImportPlan['units'][number]
  // Files of no stated kind ('sort': a paste) are sorted by what they show.
  addFiles: (files: File[], kind?: ShotKind | 'sort') => Promise<{ added: number; refused: number }>
  resultsClosed: ComputedRef<boolean>
  removeShot: (id: string) => void
  clearShots: () => void
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
  saveNames: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  loadNames()

  const boardCount = (): number => TEAM_MODES[mode()].boardCount

  // Formation shots dropped before any result shot are imported alone, and
  // no result shot joins them until they are removed: a formation panel shows
  // the player's own upgrades, never a match's.
  const resultsClosed = computed(
    () =>
      shots.value.some((s) => s.kind === 'formation') &&
      !shots.value.some((s) => s.kind === 'result'),
  )

  // Result shots refused while formation shots are imported alone are
  // counted, so the caller can say why they were not added.
  const addFiles = async (
    files: File[],
    kind: ShotKind | 'sort' = 'result',
  ): Promise<{ added: number; refused: number }> => {
    void ensureReferences()
    const mine = session
    let added = 0
    let refused = 0
    for (const file of files) {
      if (mine !== session) break
      if (shots.value.some((s) => s.name === file.name && s.size === file.size)) continue
      const sorted = kind === 'sort' ? await sortShot(file).catch(() => null) : kind
      if (mine !== session) break
      const shotKind = sorted ?? (resultsClosed.value ? 'formation' : 'result')
      if (shotKind === 'result' && resultsClosed.value) {
        refused++
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
    if (shot) shot.resultOverrides.mapIndex = mapIndex
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

  const forgetLearned = (): void => {
    learned.value = []
    writeStorage(LEARNED_KEY, serializeLearnedIcons([]))
    post({ type: 'learned', learned: [] })
  }

  // The corrections export covers result screens, the shots it was made for.
  const correctedShots = computed(() =>
    shots.value.filter(
      (shot) =>
        shot.kind === 'result' &&
        shot.reading &&
        (Object.keys(shot.overrides).length > 0 ||
          Object.keys(shot.artifactOverrides).length > 0 ||
          Object.keys(shot.resultOverrides).length > 0),
    ),
  )

  const exportCorrections = async (): Promise<string> => {
    const learnedIcons = learnedIconEnvelope(learned.value)
    const records = await Promise.all(
      correctedShots.value.map(async (shot) => {
        // Taken before the first await, so an edit made while the file hashes
        // stays out of this download; the hash itself waits until here since
        // recognition never needs it.
        const snapshot = {
          context: { season: CURRENT_SEASON, mapCount: boardCount(), imageWidth: CANONICAL_WIDTH },
          predicted: shot.reading,
          labels: {
            cells: { ...shot.overrides },
            artifacts: { ...shot.artifactOverrides },
            ...shot.resultOverrides,
          },
        }
        const response = await fetch(shot.thumb)
        if (!response.ok) throw new Error('Screenshot unavailable for correction export')
        const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer())
        const sha256 = Array.from(new Uint8Array(hash), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('')
        return { source: { name: shot.name, size: shot.size, sha256 }, ...snapshot }
      }),
    )
    return JSON.stringify(
      {
        app: 'stargazer',
        kind: 'import-corrections',
        createdAt: new Date().toISOString(),
        learnedIcons,
        shots: records,
      },
      // The envelope also names its descriptor size; only per-shot vectors are omitted.
      (key: string, value: unknown) =>
        key === 'card' || (key === 'descriptor' && ArrayBuffer.isView(value)) ? undefined : value,
      2,
    )
  }

  const formationShots = computed(() =>
    shots.value.filter(
      (s): s is ImportShot & { reading: FormationReading } =>
        s.kind === 'formation' && s.reading !== null && isFormationReading(s.reading),
    ),
  )

  const plan = computed<TeamImportPlan>(() => {
    const assignments: ShotAssignment[] = shots.value
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
      }))
    const formations: FormationAssignment[] = formationShots.value.map((s) => ({
      reading: s.reading,
      mapIndex: shotMapIndex(s, boardCount()),
      overrides: s.overrides,
      artifactOverrides: s.artifactOverrides,
      unitOverrides: s.unitOverrides,
    }))
    return buildTeamImportPlan(assignments, mode(), names, swapSides.value, formations)
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
    learnedCount: computed(() => learned.value.length),
    hasCorrections: computed(() => correctedShots.value.length > 0 || learned.value.length > 0),
    exportCorrections,
    plan,
    unitsOf,
    addFiles,
    resultsClosed,
    removeShot,
    clearShots,
    setMap,
    setWinner,
    setHero,
    setLevel,
    setArtifact,
    setUnit,
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
  sorter?.terminate()
  sorter = null
  for (const done of sorting.values()) done(null)
  sorting.clear()
  clearShots()
  referenceStatus.value = 'idle'
}
