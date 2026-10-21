/* The screenshot import's engine, under every import: decoding, the worker
 * that reads screenshots and a second one that sorts pastes, the reference
 * images they need, and the faces learned from corrections.
 * Module-level state for one page visit: each import composable holds the
 * engine while the component that uses it is mounted, and the engine is
 * disposed when none holds it, so leaving the page drops the workers and
 * their references; the learned faces stay in storage. Decoded screenshots
 * wait here and go to the worker one at a time, so closing an import drops
 * the reads it still has waiting. Images never leave the device: the
 * references are fetched, the screenshots are drawn to a canvas and handed to
 * the worker as pixels. */

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
  addLearnedIcon,
  dropLearnedIcon,
  parseLearnedIcons,
  serializeLearnedIcons,
} from '@/lib/import/learned'
import { FIT_WIDTH } from '@/lib/import/screens/formation/board'
import { FORMATION_MAX_WIDTH, FORMATION_MIN_WIDTH } from '@/lib/import/screens/formation/formation'
import type { ScreenshotReading, ShotKind } from '@/lib/import/screens/match/types'
import { RESULT_MAX_WIDTH } from '@/lib/import/screens/result/layout'
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
import type { ImportRequest, ImportResponse, ReferenceImages } from '@/workers/import.worker'

const LEARNED_KEY = 'stargazer.import.learned'

export type ShotStatus = 'reading' | 'ready' | 'failed'
// Why a shot failed: its file, the references (not loaded, or the worker
// itself did not start), or the reading throwing on it.
export type ShotError = 'too-small' | 'unsupported' | 'references' | 'worker' | 'read'

export type ReferenceStatus = 'idle' | 'loading' | 'ready' | 'failed'

// What the engine needs of an import's screenshot: it moves the shot through
// reading, ready and failed.
export interface EngineShot {
  id: string
  kind: ShotKind
  // The file's name, for the console when its reading fails.
  name: string
  status: ShotStatus
  error: ShotError | null
}

// An import's own screenshots: the engine finds them here, and hands each
// reading to `apply` for the import to keep.
export interface ShotSession {
  shots: () => readonly EngineShot[]
  apply: (id: string, reading: ScreenshotReading) => void
}

// The widths each kind is read within: narrower is refused, wider is drawn
// down to the most.
const DECODE_WIDTHS: Record<ShotKind, { min: number; max: number }> = {
  result: { min: 600, max: RESULT_MAX_WIDTH },
  formation: { min: FORMATION_MIN_WIDTH, max: FORMATION_MAX_WIDTH },
  replay: { min: 600, max: RESULT_MAX_WIDTH },
}

const sessions = new Set<ShotSession>()
// The components holding the engine; the last to let go disposes it.
let holders = 0
const referenceStatus = ref<ReferenceStatus>('idle')
// Shallow, and only ever replaced: the list is posted to the worker as is,
// and a reactive proxy cannot be structured-cloned.
const learned = shallowRef<LearnedIcon[]>([])
let learnedLoaded = false
let worker: Worker | null = null
// A second worker of the same kind sorts pasted screenshots, so a paste is
// sorted at once even while the first is busy reading. It is ready once it
// holds the arena that tells a replay frame.
let sorter: Promise<Worker> | null = null
// The arena picture, fetched once and copied to each worker.
let arena: Promise<RgbaImage> | null = null
const sorting = new Map<string, (kind: ShotKind | null) => void>()
let nextSortId = 1
// A page visit. Work still in flight from an earlier one (a decode, a
// reference fetch) checks this before touching the current state.
let visit = 0
// Decoded shots waiting for the worker, oldest first, and the shot it is
// reading. A shot failed by the references stays queued for the retry the
// next load makes.
const queue: { id: string; image: RgbaImage; kind: ShotKind }[] = []
let inFlight: string | null = null

const findShot = (id: string): { shot: EngineShot; session: ShotSession } | null => {
  for (const session of sessions) {
    const shot = session.shots().find((s) => s.id === id)
    if (shot) return { shot, session }
  }
  return null
}

const failReadingShots = (error: ShotError): void => {
  for (const session of sessions) {
    for (const shot of session.shots()) {
      if (shot.status === 'reading') {
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

const post = (message: ImportRequest, transfer: Transferable[] = []): void => {
  worker?.postMessage(message, transfer)
}

// The next waiting shot to the worker, once it has its references and is free.
const dispatch = (): void => {
  if (!worker || inFlight !== null || referenceStatus.value !== 'ready') return
  const next = queue.shift()
  if (!next) return
  inFlight = next.id
  post({ type: 'read', ...next }, [next.image.data.buffer])
}

const onMessage = (event: MessageEvent<ImportResponse>): void => {
  const msg = event.data
  if (msg.type === 'ready') {
    referenceStatus.value = 'ready'
    // Includes shots failed by an earlier reference load; this one reads them.
    for (const { id } of queue) {
      const found = findShot(id)
      if (!found) continue
      found.shot.status = 'reading'
      found.shot.error = null
    }
    dispatch()
    return
  }
  if (msg.type === 'error') {
    if (msg.id === null) {
      // The reference tables themselves failed to build.
      console.error('Screenshot import references failed', msg.message)
      referenceStatus.value = 'failed'
      failReadingShots('references')
      return
    }
    if (inFlight === msg.id) inFlight = null
    const found = findShot(msg.id)
    if (found) {
      console.error(`Screenshot import could not read ${found.shot.name}`, msg.message)
      found.shot.status = 'failed'
      found.shot.error = 'read'
    }
    dispatch()
    return
  }
  // Sorting is the second worker's.
  if (msg.type !== 'reading') return
  if (inFlight === msg.id) inFlight = null
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
    // Pastes are still sorted between formations and results.
  }
  return started
}

/* Which kind a screenshot is, for one that came with none (a paste); null
   when it cannot be told, and the caller's default stands. A replay frame is
   only told when `replay` allows one. */
const sortShot = async (file: Blob, replay: boolean): Promise<ShotKind | null> => {
  const mine = visit
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

const startWorker = (): Worker => {
  const started = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = onMessage
  // A worker that fails to start is dropped, so the next attempt gets a fresh
  // one; the shot it was reading goes with it.
  started.onerror = () => {
    started.terminate()
    worker = null
    inFlight = null
    referenceStatus.value = 'failed'
    failReadingShots('worker')
  }
  return started
}

async function ensureReferences(): Promise<void> {
  if (referenceStatus.value === 'ready' || referenceStatus.value === 'loading') return
  referenceStatus.value = 'loading'
  const mine = visit
  try {
    worker ??= startWorker()
    const refs = await loadReferences()
    if (mine !== visit) return
    const transfer = [
      ...refs.frames.map((f) => f.data.buffer),
      ...refs.portraits.map((p) => p.image.data.buffer),
      ...refs.artifacts.map((a) => a.image.data.buffer),
      ...refs.units.map((u) => u.image.data.buffer),
      ...(refs.arena ? [refs.arena.data.buffer] : []),
    ]
    post({ type: 'references', ...refs }, transfer)
  } catch (error) {
    if (mine !== visit) return
    // Left in the console: the modal only says the references failed, and
    // the failing URL is what a bug report needs.
    console.error('Screenshot import references failed to load', error)
    referenceStatus.value = 'failed'
    failReadingShots('references')
  }
}

// ---------- shots ----------

const decodeShot = async (file: Blob, kind: ShotKind): Promise<RgbaImage> => {
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

// Decode a shot and queue it for the worker. With the references failed the
// shot fails too, but its pixels stay queued for the retry the next added shot
// makes.
const readShot = async (shot: EngineShot, file: Blob): Promise<void> => {
  const mine = visit
  try {
    const image = await decodeShot(file, shot.kind)
    if (mine !== visit || !findShot(shot.id)) return
    queue.push({ id: shot.id, image, kind: shot.kind })
    if (referenceStatus.value === 'failed') {
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

// ---------- learned faces ----------

const saveLearned = (next: LearnedIcon[]): void => {
  learned.value = next
  writeStorage(LEARNED_KEY, serializeLearnedIcons(next))
  post({ type: 'learned', learned: next })
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
  worker?.terminate()
  worker = null
  inFlight = null
  queue.length = 0
  void sorter?.then((w) => w.terminate())
  sorter = null
  for (const done of sorting.values()) done(null)
  sorting.clear()
  referenceStatus.value = 'idle'
}

export interface ImportEngine {
  referenceStatus: Ref<ReferenceStatus>
  learnedCount: ComputedRef<number>
  ensureReferences: () => Promise<void>
  readShot: (shot: EngineShot, file: Blob) => Promise<void>
  sortShot: (file: Blob, replay: boolean) => Promise<ShotKind | null>
  dropShot: (id: string) => void
  learnFace: (characterId: number | null, descriptor: Float32Array) => void
  forgetLearned: () => void
}

const engine: ImportEngine = {
  referenceStatus,
  learnedCount: computed(() => learned.value.length),
  ensureReferences,
  readShot,
  sortShot,
  dropShot,
  learnFace,
  forgetLearned,
}

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
  return engine
}
