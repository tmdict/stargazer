/* The screenshot import's engine, under every import: decoding, the workers
 * that read screenshots and one more that sorts them, the reference images
 * they need, and the faces learned from corrections.
 * Module-level state for one page visit: each import composable holds the
 * engine while the component that uses it is mounted, and the engine is
 * disposed when none holds it, so leaving the page drops the workers and
 * their references; the learned faces stay in storage. Decoded screenshots
 * wait here and go to a reading worker one at a time each, so closing an
 * import drops the reads it still has waiting. Every import adds its files
 * through `addFiles`, which sorts each before the import places it. The
 * references come in two parts (lib/import/kinds), each fetched once per
 * visit, and every reading worker holds its own copy of each. Images never
 * leave the device: the
 * references are fetched, the screenshots are drawn to a canvas and handed to
 * the workers as pixels. */

import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  type ComputedRef,
  type Ref,
} from 'vue'

import arenaUrl from '@/assets/import/replay-arena.png'
import { isBaseHeroId } from '@/lib/characters/character'
import { companionImages } from '@/lib/characters/companion'
import { inPhantimalBand, toPhantimalId } from '@/lib/characters/phantimal'
import { FRAME_NAMES } from '@/lib/import/card/frames'
import type { LearnedIcon, PortraitRef } from '@/lib/import/card/types'
import type { RgbaImage } from '@/lib/import/core/types'
import {
  partsOf,
  type ImportKind,
  type ImportReading,
  type ReferencePart,
} from '@/lib/import/kinds'
import {
  addLearnedIcon,
  dropLearnedIcon,
  parseLearnedIcons,
  serializeLearnedIcons,
} from '@/lib/import/learned'
import { FORMATION_MAX_WIDTH, FORMATION_MIN_WIDTH } from '@/lib/import/screens/formation/formation'
import { RESULT_MAX_WIDTH } from '@/lib/import/screens/result/layout'
import { ROSTER_MAX_WIDTH, ROSTER_MIN_WIDTH } from '@/lib/import/screens/roster/roster'
import { SORT_WIDTH } from '@/lib/import/sort'
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
  HeroReferences,
  ImportRequest,
  ImportResponse,
  MatchReferences,
} from '@/workers/import.worker'

const LEARNED_KEY = 'stargazer.import.learned'

export type ShotStatus = 'reading' | 'ready' | 'failed'
// Why a shot failed: its file, the references (not loaded), a reading worker
// that failed to start or stopped while reading it, or the reading throwing
// on it.
export type ShotError = 'too-small' | 'unsupported' | 'references' | 'worker' | 'read'

export type ReferenceStatus = 'idle' | 'loading' | 'ready' | 'failed'

// What the engine needs of an import's screenshot: it moves the shot through
// reading, ready and failed. A file of the same name and size is the same
// screenshot added again.
export interface EngineShot {
  id: string
  kind: ImportKind
  name: string
  size: number
  status: ShotStatus
  error: ShotError | null
}

// An import's own screenshots: the engine finds them here, and hands each
// reading to `apply` for the import to keep. `kinds`: the kinds it reads,
// which set the references its screenshots wait for.
export interface ShotSession {
  kinds: readonly ImportKind[]
  shots: () => readonly EngineShot[]
  apply: (id: string, reading: ImportReading) => void
}

// Where an import puts an added file once the sorter has looked at it: read as
// `kind`, or turned away and counted under the kind given.
export type Placement<K extends ImportKind> = { kind: K } | { refused: ImportKind }

export interface Intake<K extends ImportKind, S extends EngineShot> {
  // False once the opening of the import that added the files has ended.
  current: () => boolean
  // Whether the sorter may tell a replay frame, asked for each file.
  replay: () => boolean
  place: (sorted: ImportKind | null) => Placement<K>
  // The import's shot for a file it reads, added to its list.
  add: (file: File, kind: K) => S
}

export interface IntakeResult {
  added: number
  refused: Partial<Record<ImportKind, number>>
}

// The widths each kind is read within: narrower is refused, wider is drawn
// down to the most.
const DECODE_WIDTHS: Record<ImportKind, { min: number; max: number }> = {
  result: { min: 600, max: RESULT_MAX_WIDTH },
  formation: { min: FORMATION_MIN_WIDTH, max: FORMATION_MAX_WIDTH },
  replay: { min: 600, max: RESULT_MAX_WIDTH },
  roster: { min: ROSTER_MIN_WIDTH, max: ROSTER_MAX_WIDTH },
}

const PARTS: readonly ReferencePart[] = ['heroes', 'match']

const sessions = new Set<ShotSession>()
// The components holding the engine; the last to let go disposes it.
let holders = 0
// A part is ready once a reading worker holds it.
const partStatus: Record<ReferencePart, Ref<ReferenceStatus>> = {
  heroes: ref('idle'),
  match: ref('idle'),
}
// Each part's images once fetched, kept for the visit so a worker started
// later gets its own copy (the learned faces travel with the hero part).
const loaded: {
  heroes: Omit<HeroReferences, 'learned'> | null
  match: MatchReferences | null
} = { heroes: null, match: null }
// Shallow, and only ever replaced: the list is posted to the workers as is,
// and a reactive proxy cannot be structured-cloned.
const learned = shallowRef<LearnedIcon[]>([])
let learnedLoaded = false
// The reading workers, each with the parts it holds and the shot it reads.
interface Reader {
  worker: Worker
  parts: Set<ReferencePart>
  reading: string | null
}
const readers: Reader[] = []
// A reader failed this visit. The pool then stops growing: a device short of
// memory would fail every new reader the same way, each after copying the
// references.
let readerFailed = false
// One more worker of the same kind sorts the screenshots added, so each is
// sorted at once even while the readers are busy. It is ready once it holds
// the arena that tells a replay frame.
let sorter: Promise<Worker> | null = null
// The arena picture, fetched once and copied to each worker.
let arena: Promise<RgbaImage> | null = null
const sorting = new Map<string, (kind: ImportKind | null) => void>()
let nextSortId = 1
// A page visit. Work still in flight from an earlier one (a decode, a
// reference fetch) checks this before touching the current state.
let visit = 0
// Decoded shots waiting for a reading worker, oldest first. A shot failed by
// the references stays queued for the retry the next load makes.
const queue: { id: string; image: RgbaImage; kind: ImportKind }[] = []

const findShot = (id: string): { shot: EngineShot; session: ShotSession } | null => {
  for (const session of sessions) {
    const shot = session.shots().find((s) => s.id === id)
    if (shot) return { shot, session }
  }
  return null
}

// Fail the shots still reading, those waiting for `part` when one is given.
const failReadingShots = (error: ShotError, part?: ReferencePart): void => {
  for (const session of sessions) {
    for (const shot of session.shots()) {
      if (shot.status === 'reading' && (!part || partsOf(shot.kind).includes(part))) {
        shot.status = 'failed'
        shot.error = error
      }
    }
  }
}

const loadLearned = (): void => {
  if (learnedLoaded) return
  learnedLoaded = true
  learned.value = parseLearnedIcons(readStorage(LEARNED_KEY))
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

export const imageToDataUrl = (image: RgbaImage): string => {
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

// The hero part every import reads with: the frames, the hero portraits and
// the costumes.
async function loadHeroPart(): Promise<Omit<HeroReferences, 'learned'>> {
  const gameData = useGameDataStore()
  const portraitLoaders = loadMatcherPortraits()
  const heroes = gameData.characters.filter(
    (c) => isBaseHeroId(c.id) && !c.placeholder && portraitLoaders[c.name],
  )
  const ids = new Map(gameData.characters.map((c) => [c.name, c.id]))
  const [portraits, costumes, frames] = await Promise.all([
    Promise.all(
      heroes.map(async (hero) => ({
        characterId: hero.id,
        image: await fetchImage(await portraitLoaders[hero.name]!()),
      })),
    ),
    loadCostumes((slug) => ids.get(slug)),
    Promise.all(FRAME_NAMES.map((name) => fetchImage(importReferenceUrl(`frame-${name}`)))),
  ])
  return { frames, portraits: [...portraits, ...costumes] }
}

// The match part the team import adds: artifact icons, the units a formation
// board can field, and the arena of replay frames.
async function loadMatchPart(): Promise<MatchReferences> {
  const gameData = useGameDataStore()
  const portraitLoaders = loadMatcherPortraits()
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
  ).filter((ref): ref is MatchReferences['artifacts'][number] => ref !== null)
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
  // Only replay frames need the arena, so the rest read without it.
  return { artifacts, units, arena: await loadArena().then(copyImage, () => null) }
}

// A reader's own copy of a fetched part, its pixels handed over with it.
const postPart = (reader: Reader, part: ReferencePart): void => {
  if (part === 'heroes' && loaded.heroes) {
    const frames = loaded.heroes.frames.map(copyImage)
    const portraits = loaded.heroes.portraits.map((p) => ({ ...p, image: copyImage(p.image) }))
    const message: ImportRequest = { type: 'heroes', frames, portraits, learned: learned.value }
    reader.worker.postMessage(message, [
      ...frames.map((f) => f.data.buffer),
      ...portraits.map((p) => p.image.data.buffer),
    ])
  }
  if (part === 'match' && loaded.match) {
    const artifacts = loaded.match.artifacts.map((a) => ({ ...a, image: copyImage(a.image) }))
    const units = loaded.match.units.map((u) => ({ ...u, image: copyImage(u.image) }))
    const arena = loaded.match.arena && copyImage(loaded.match.arena)
    const message: ImportRequest = { type: 'match', artifacts, units, arena }
    reader.worker.postMessage(message, [
      ...artifacts.map((a) => a.image.data.buffer),
      ...units.map((u) => u.image.data.buffer),
      ...(arena ? [arena.data.buffer] : []),
    ])
  }
}

// How many workers a roster import reads with (one is enough for a match's
// few screenshots): up to three, one fewer than the device's cores, and only
// one where the device reports little memory, each holding its own copy of the
// hero part.
const poolSize = (): number => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory < 4) return 1
  return Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1))
}

// Each free reader takes the oldest waiting shot whose parts it holds; a
// roster shot left waiting with every reader busy starts another reader.
const dispatch = (): void => {
  for (const reader of readers) {
    if (reader.reading !== null) continue
    const at = queue.findIndex((read) => partsOf(read.kind).every((p) => reader.parts.has(p)))
    if (at < 0) continue
    const next = queue.splice(at, 1)[0]!
    reader.reading = next.id
    const message: ImportRequest = { type: 'read', ...next }
    reader.worker.postMessage(message, [next.image.data.buffer])
  }
  if (
    readers.length > 0 &&
    !readerFailed &&
    readers.length < poolSize() &&
    readers.every((r) => r.reading !== null) &&
    queue.some((read) => read.kind === 'roster')
  ) {
    startReader()
  }
}

const onMessage = (reader: Reader, msg: ImportResponse): void => {
  if (msg.type === 'ready') {
    reader.parts.add(msg.part)
    partStatus[msg.part].value = 'ready'
    // Includes shots failed by an earlier reference load; this one reads them.
    for (const { id, kind } of queue) {
      const found = findShot(id)
      if (!found || !partsOf(kind).every((p) => partStatus[p].value === 'ready')) continue
      found.shot.status = 'reading'
      found.shot.error = null
    }
    dispatch()
    return
  }
  if (msg.type === 'error') {
    if (msg.id === null) {
      // A part's tables failed to build in this reader. The others may hold
      // them, so only this one goes.
      console.error('Screenshot import references failed', msg.message)
      if (msg.part) dropReader(reader, 'references')
      return
    }
    if (reader.reading === msg.id) reader.reading = null
    const found = findShot(msg.id)
    if (found) {
      console.error(`Screenshot import could not read ${found.shot.name}`, msg.message)
      found.shot.status = 'failed'
      found.shot.error = 'read'
    }
    dispatch()
    return
  }
  // Sorting is the sorter's.
  if (msg.type !== 'reading') return
  if (reader.reading === msg.id) reader.reading = null
  const found = findShot(msg.id)
  if (found) {
    found.shot.status = 'ready'
    found.shot.error = null
    found.session.apply(msg.id, msg.reading)
  }
  dispatch()
}

const startSorter = async (): Promise<Worker> => {
  const started = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = (event: MessageEvent<ImportResponse>) => {
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
    const message: ImportRequest = { type: 'arena', image }
    started.postMessage(message, [image.data.buffer])
  } catch {
    // Screenshots are still sorted, with no replay frame told.
  }
  return started
}

/* Which import and kind a screenshot shows; null when it cannot be told, and
   the caller's default stands. A replay frame is only told when `replay`
   allows one. */
const sortShot = async (file: Blob, replay: boolean): Promise<ImportKind | null> => {
  const mine = visit
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let image: RgbaImage
  try {
    const width = Math.min(bitmap.width, SORT_WIDTH)
    image = drawToImage(bitmap, width, Math.round((bitmap.height * width) / bitmap.width))
  } finally {
    bitmap.close()
  }
  // The page was left meanwhile: no sorter is started for it.
  if (mine !== visit) return null
  const started = (sorter ??= startSorter())
  const target = await started
  // The sorter failed while starting, and its error answered the sorts it had.
  if (sorter !== started) return null
  const id = `sort-${nextSortId++}`
  return new Promise((resolve) => {
    sorting.set(id, resolve)
    const message: ImportRequest = { type: 'sort', id, image, replay }
    target.postMessage(message, [image.data.buffer])
  })
}

// A reader started with its own copy of every part fetched so far; later parts
// reach it as they load.
const startReader = (): Reader => {
  const reader: Reader = {
    worker: new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
      type: 'module',
    }),
    parts: new Set(),
    reading: null,
  }
  reader.worker.onmessage = (event: MessageEvent<ImportResponse>) => onMessage(reader, event.data)
  reader.worker.onerror = () => dropReader(reader, 'worker')
  readers.push(reader)
  for (const part of PARTS) postPart(reader, part)
  return reader
}

/* A reader that fails is dropped, and the shot it was reading goes with it;
 * with none left the references count as failed, and the next attempt starts
 * a fresh one. */
function dropReader(reader: Reader, error: ShotError): void {
  const at = readers.indexOf(reader)
  // Already dropped: a crash can follow the error that dropped it.
  if (at < 0) return
  readers.splice(at, 1)
  reader.worker.terminate()
  readerFailed = true
  const lost = reader.reading === null ? null : findShot(reader.reading)
  if (lost) {
    lost.shot.status = 'failed'
    lost.shot.error = 'worker'
  }
  if (readers.length > 0) {
    dispatch()
    return
  }
  for (const part of PARTS) {
    if (partStatus[part].value !== 'idle') partStatus[part].value = 'failed'
  }
  failReadingShots(error)
}

// Fetch a part once and give every reader its copy; ready once one says so.
async function ensurePart(part: ReferencePart): Promise<void> {
  const status = partStatus[part]
  if (status.value === 'ready' || status.value === 'loading') return
  status.value = 'loading'
  const mine = visit
  try {
    if (readers.length === 0) startReader()
    // Kept only for the visit that asked: a page left meanwhile has dropped
    // its readers, and the next visit fetches its own.
    if (part === 'heroes') {
      const heroes = await loadHeroPart()
      if (mine !== visit) return
      loaded.heroes = heroes
    } else {
      const match = await loadMatchPart()
      if (mine !== visit) return
      loaded.match = match
    }
    for (const reader of readers) postPart(reader, part)
  } catch (error) {
    if (mine !== visit) return
    // Left in the console: the modal only says the references failed, and
    // the failing URL is what a bug report needs.
    console.error('Screenshot import references failed to load', error)
    status.value = 'failed'
    failReadingShots('references', part)
  }
}

// ---------- shots ----------

const decodeShot = async (file: Blob, kind: ImportKind): Promise<RgbaImage> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const { min, max } = DECODE_WIDTHS[kind]
    if (bitmap.width < min) throw new Error('too small')
    const width = Math.min(bitmap.width, max)
    return drawToImage(bitmap, width, Math.round((bitmap.height * width) / bitmap.width))
  } finally {
    bitmap.close()
  }
}

// Decode a shot and queue it. With a part it needs failed the shot fails too,
// but its pixels stay queued for the retry the next added shot makes.
const readShot = async (shot: EngineShot, file: Blob): Promise<void> => {
  const mine = visit
  try {
    const image = await decodeShot(file, shot.kind)
    if (mine !== visit || !findShot(shot.id)) return
    queue.push({ id: shot.id, image, kind: shot.kind })
    if (partsOf(shot.kind).some((p) => partStatus[p].value === 'failed')) {
      shot.status = 'failed'
      shot.error = 'references'
    }
    dispatch()
  } catch (error) {
    if (mine !== visit || !findShot(shot.id)) return
    shot.status = 'failed'
    shot.error =
      error instanceof Error && error.message === 'too small' ? 'too-small' : 'unsupported'
  }
}

// A shot the import let go of: its waiting read is dropped, and a reading
// already under way finds no shot to give it to.
const dropShot = (id: string): void => {
  const at = queue.findIndex((read) => read.id === id)
  if (at >= 0) queue.splice(at, 1)
}

const saveLearned = (next: LearnedIcon[]): void => {
  learned.value = next
  writeStorage(LEARNED_KEY, serializeLearnedIcons(next))
  const message: ImportRequest = { type: 'learned', learned: next }
  for (const reader of readers) reader.worker.postMessage(message)
}

/* Teach a face as a hero; with no hero, take back what the face was taught. */
const learnFace = (characterId: number | null, descriptor: Float32Array): void => {
  if (characterId !== null) {
    saveLearned(addLearnedIcon(learned.value, characterId, descriptor, Date.now()))
    return
  }
  const next = dropLearnedIcon(learned.value, descriptor)
  if (next.length !== learned.value.length) saveLearned(next)
}

const forgetLearned = (): void => saveLearned([])

/* Drop the workers, their references and every waiting read: the last holder
 * left the page. */
const dispose = (): void => {
  visit++
  for (const reader of readers) reader.worker.terminate()
  readers.length = 0
  readerFailed = false
  queue.length = 0
  loaded.heroes = null
  loaded.match = null
  void sorter?.then((w) => w.terminate())
  sorter = null
  for (const done of sorting.values()) done(null)
  sorting.clear()
  for (const part of PARTS) partStatus[part].value = 'idle'
}

// The status of the parts an import reads with: failed or loading if any is,
// ready once all are.
const statusOf = (parts: readonly ReferencePart[]): ReferenceStatus => {
  const statuses = parts.map((p) => partStatus[p].value)
  if (statuses.includes('failed')) return 'failed'
  if (statuses.includes('loading')) return 'loading'
  return statuses.every((st) => st === 'ready') ? 'ready' : 'idle'
}

export interface ImportEngine {
  referenceStatus: ComputedRef<ReferenceStatus>
  learnedCount: ComputedRef<number>
  // Files an `addFiles` call has yet to sort and add.
  adding: ComputedRef<number>
  ensureReferences: () => Promise<void>
  addFiles: <K extends ImportKind, S extends EngineShot>(
    files: File[],
    intake: Intake<K, S>,
  ) => Promise<IntakeResult>
  dropShot: (id: string) => void
  learnFace: (characterId: number | null, descriptor: Float32Array) => void
  forgetLearned: () => void
}

const learnedCount = computed(() => learned.value.length)

/* The engine for an import's session of shots. Called in a component's setup,
 * it holds the engine until the component unmounts. */
export function useImportEngine(session: ShotSession): ImportEngine {
  loadLearned()
  sessions.add(session)
  if (getCurrentScope()) {
    holders++
    onScopeDispose(() => {
      holders--
      if (holders === 0) dispose()
    })
  }
  const parts = [...new Set(session.kinds.flatMap(partsOf))]
  const ensureReferences = async (): Promise<void> => {
    await Promise.all(parts.map(ensurePart))
  }
  const adding = ref(0)

  /* Each file is sorted, then placed by the import: read as the kind it
   * gives, or turned away. A file already among the shots is skipped. One at
   * a time, so the shots keep the files' order. Adding stops when the import's
   * opening ends or the page is left. */
  const addFiles = async <K extends ImportKind, S extends EngineShot>(
    files: File[],
    { current, replay, place, add }: Intake<K, S>,
  ): Promise<IntakeResult> => {
    void ensureReferences()
    const mine = visit
    const open = (): boolean => mine === visit && current()
    const result: IntakeResult = { added: 0, refused: {} }
    adding.value += files.length
    let settled = 0
    const settle = (): void => {
      settled++
      adding.value--
    }
    try {
      for (const file of files) {
        if (!open()) break
        if (session.shots().some((s) => s.name === file.name && s.size === file.size)) {
          settle()
          continue
        }
        const sorted = await sortShot(file, replay()).catch(() => null)
        if (!open()) break
        const placed = place(sorted)
        settle()
        if ('refused' in placed) {
          result.refused[placed.refused] = (result.refused[placed.refused] ?? 0) + 1
          continue
        }
        result.added++
        await readShot(add(file, placed.kind), file)
      }
    } finally {
      adding.value -= files.length - settled
    }
    return result
  }

  return {
    referenceStatus: computed(() => statusOf(parts)),
    learnedCount,
    adding: computed(() => adding.value),
    ensureReferences,
    addFiles,
    dropShot,
    learnFace,
    forgetLearned,
  }
}
