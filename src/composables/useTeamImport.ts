/* Match screenshot import: file intake, decoding, the worker that reads the
 * screenshots, the reference images it needs, and the review state per
 * screenshot. Module-level state like useSelectionState, so the modal can be
 * closed and reopened without losing the shots; TeamsView disposes it on
 * leave. Images never leave the device: the references are fetched, the
 * screenshots are drawn to a canvas and handed to the worker as pixels. */

import { computed, reactive, ref, type ComputedRef } from 'vue'

import { isBaseHeroId } from '@/lib/characters/character'
import { FRAME_NAMES } from '@/lib/import/frames'
import { CANONICAL_WIDTH } from '@/lib/import/layout'
import { addLearnedIcon, parseLearnedIcons, serializeLearnedIcons } from '@/lib/import/learned'
import type { LearnedIcon, PortraitRef, RgbaImage, ScreenshotReading } from '@/lib/import/types'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import {
  buildTeamImportPlan,
  overrideKey,
  type CellOverride,
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
  seasonArtifactImageUrl,
} from '@/utils/artifactImage'
import { loadMatcherPortraits } from '@/utils/dataLoader'
import { readStorage, writeStorage } from '@/utils/storage'
import type { TeamImportRequest, TeamImportResponse } from '@/workers/teamImport.worker'

const NAMES_KEY = 'stargazer.import.names'
const LEARNED_KEY = 'stargazer.import.learned'

export type ShotStatus = 'reading' | 'ready' | 'failed'

export interface ImportShot {
  id: string
  name: string
  size: number
  // Object URL of the file, for the card thumbnail.
  thumb: string
  status: ShotStatus
  error: string | null
  reading: ScreenshotReading | null
  // 0-based board; detected from the strip, editable.
  mapIndex: number | null
  // Who won this map; detected from the Ally tab, editable.
  winner: Team | null
  overrides: Record<string, CellOverride>
  artifactOverrides: Partial<Record<Team, number | null>>
  // Data URLs of each card as located, keyed like overrides.
  cards: Record<string, string>
  // Cells whose hero was corrected during review.
  edited: Set<string>
}

export type ReferenceStatus = 'idle' | 'loading' | 'ready' | 'failed'

const shots = ref<ImportShot[]>([])
const referenceStatus = ref<ReferenceStatus>('idle')
const names = reactive<RecordNames>({ prefix: `S${CURRENT_SEASON}`, left: '', right: '' })
const learned = ref<LearnedIcon[]>([])
let worker: Worker | null = null
let nextId = 1
let namesLoaded = false
// Reads waiting on the worker, by shot id.
const pending = new Map<string, { mapCount: number; image: RgbaImage }>()

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

// Reactive proxies cannot be structured-cloned into the worker.
const plainLearned = (): LearnedIcon[] => learned.value.map((icon) => ({ ...icon }))

const saveNames = (): void => {
  writeStorage(
    NAMES_KEY,
    JSON.stringify({ prefix: names.prefix, left: names.left, right: names.right }),
  )
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
  // Copied: the worker's buffer may not be a plain ArrayBuffer for ImageData.
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
    0,
    0,
  )
  return canvas.toDataURL('image/jpeg', 0.85)
}

// ---------- references and the worker ----------

// Costume references from chaldea, or none when the manifest is missing; a
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

async function loadReferences(): Promise<
  Omit<Extract<TeamImportRequest, { type: 'references' }>, 'type'>
> {
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
  const artifacts = await Promise.all(
    gameData.artifacts.map(async (artifact) => ({
      artifactId: artifact.id,
      image: await fetchImage(
        isRemoteArtifact(artifact.season)
          ? seasonArtifactImageUrl(artifact.name)
          : gameData.getArtifactImage(artifact.name),
        128,
      ),
    })),
  )
  return { frames, portraits: [...portraits, ...costumes], artifacts, learned: plainLearned() }
}

const post = (message: TeamImportRequest, transfer: Transferable[] = []): void => {
  worker?.postMessage(message, transfer)
}

const applyReading = (shot: ImportShot, reading: ScreenshotReading): void => {
  shot.reading = reading
  shot.status = 'ready'
  if (reading.mapIndex !== null) shot.mapIndex = reading.mapIndex
  shot.winner = reading.winner
  for (const team of [Team.ALLY, Team.ENEMY]) {
    reading.sides[team].forEach((cell, row) => {
      shot.cards[overrideKey(team, row)] = imageToDataUrl(cell.card)
    })
  }
}

const onMessage = (event: MessageEvent<TeamImportResponse>): void => {
  const msg = event.data
  if (msg.type === 'ready') {
    referenceStatus.value = 'ready'
    for (const [id, job] of pending) {
      post({ type: 'read', id, image: job.image, mapCount: job.mapCount }, [job.image.data.buffer])
    }
    pending.clear()
    return
  }
  const shot = shots.value.find((s) => s.id === msg.id)
  if (!shot) return
  if (msg.type === 'reading') applyReading(shot, msg.reading)
  else {
    shot.status = 'failed'
    shot.error = msg.message
  }
}

async function ensureReferences(): Promise<void> {
  if (referenceStatus.value === 'ready' || referenceStatus.value === 'loading') return
  referenceStatus.value = 'loading'
  loadNames()
  try {
    worker ??= new Worker(new URL('../workers/teamImport.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = onMessage
    worker.onerror = () => {
      referenceStatus.value = 'failed'
      for (const shot of shots.value) {
        if (shot.status === 'reading') {
          shot.status = 'failed'
          shot.error = 'worker'
        }
      }
    }
    const refs = await loadReferences()
    const transfer = [
      ...refs.frames.map((f) => f.data.buffer),
      ...refs.portraits.map((p) => p.image.data.buffer),
      ...refs.artifacts.map((a) => a.image.data.buffer),
    ]
    post({ type: 'references', ...refs }, transfer)
  } catch (error) {
    // Left in the console: the modal only says the references failed, and
    // the failing URL is what a bug report needs.
    console.error('Match import references failed to load', error)
    referenceStatus.value = 'failed'
    for (const shot of shots.value) {
      if (shot.status === 'reading') {
        shot.status = 'failed'
        shot.error = 'references'
      }
    }
  }
}

// ---------- shots ----------

const decodeShot = async (file: File): Promise<RgbaImage> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    if (bitmap.width < 600) throw new Error('too small')
    const height = Math.round((bitmap.height * CANONICAL_WIDTH) / bitmap.width)
    return drawToImage(bitmap, CANONICAL_WIDTH, height)
  } finally {
    bitmap.close()
  }
}

export function useTeamImport(mode: () => TeamModeKey): {
  shots: typeof shots
  referenceStatus: typeof referenceStatus
  names: RecordNames
  learnedCount: ComputedRef<number>
  plan: ComputedRef<TeamImportPlan>
  addFiles: (files: File[]) => Promise<number>
  removeShot: (id: string) => void
  clear: () => void
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
  saveNames: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  loadNames()

  const addFiles = async (files: File[]): Promise<number> => {
    void ensureReferences()
    const mapCount = TEAM_MODES[mode()].boardCount
    let added = 0
    for (const file of files) {
      if (shots.value.some((s) => s.name === file.name && s.size === file.size)) continue
      const shot: ImportShot = reactive({
        id: `shot-${nextId++}`,
        name: file.name,
        size: file.size,
        thumb: URL.createObjectURL(file),
        status: 'reading',
        error: null,
        reading: null,
        mapIndex: null,
        winner: null,
        overrides: {},
        artifactOverrides: {},
        cards: {},
        edited: new Set<string>(),
      }) as ImportShot
      shots.value = [...shots.value, shot]
      added++
      try {
        const image = await decodeShot(file)
        if (referenceStatus.value === 'ready') {
          post({ type: 'read', id: shot.id, image, mapCount }, [image.data.buffer])
        } else if (referenceStatus.value === 'failed') {
          shot.status = 'failed'
          shot.error = 'references'
        } else {
          pending.set(shot.id, { mapCount, image })
        }
      } catch (error) {
        shot.status = 'failed'
        shot.error =
          error instanceof Error && error.message === 'too small' ? 'too-small' : 'unsupported'
      }
    }
    return added
  }

  const removeShot = (id: string): void => {
    const shot = shots.value.find((s) => s.id === id)
    if (shot) URL.revokeObjectURL(shot.thumb)
    pending.delete(id)
    shots.value = shots.value.filter((s) => s.id !== id)
  }

  const clear = (): void => {
    for (const shot of shots.value) URL.revokeObjectURL(shot.thumb)
    pending.clear()
    shots.value = []
  }

  const setMap = (id: string, mapIndex: number | null): void => {
    const shot = shots.value.find((s) => s.id === id)
    if (shot) shot.mapIndex = mapIndex
  }

  const setWinner = (id: string, winner: Team | null): void => {
    const shot = shots.value.find((s) => s.id === id)
    if (shot) shot.winner = winner
  }

  const setHero = (id: string, team: Team, row: number, characterId: number | null): void => {
    const shot = shots.value.find((s) => s.id === id)
    const cell = shot?.reading?.sides[team][row]
    if (!shot || !cell) return
    const key = overrideKey(team, row)
    shot.overrides[key] = { ...shot.overrides[key], characterId }
    shot.edited.add(key)
    // A correction on a cell the reader was unsure about teaches it that
    // icon, provided the frame match was trustworthy (else the crop may be
    // off the face) and the hero was not already its confident answer.
    if (
      characterId !== null &&
      cell.paragon.sure &&
      !cell.sure &&
      cell.candidates[0]?.characterId !== characterId
    ) {
      learned.value = addLearnedIcon(learned.value, characterId, cell.descriptor, Date.now())
      writeStorage(LEARNED_KEY, serializeLearnedIcons(learned.value))
      post({ type: 'learned', learned: plainLearned() })
    }
  }

  const setLevel = (
    id: string,
    team: Team,
    row: number,
    field: 'paragon' | 'refinement',
    level: number,
  ): void => {
    const shot = shots.value.find((s) => s.id === id)
    if (!shot) return
    const key = overrideKey(team, row)
    shot.overrides[key] = { ...shot.overrides[key], [field]: level }
  }

  const setArtifact = (id: string, team: Team, artifactId: number | null): void => {
    const shot = shots.value.find((s) => s.id === id)
    if (shot) shot.artifactOverrides[team] = artifactId
  }

  const forgetLearned = (): void => {
    learned.value = []
    writeStorage(LEARNED_KEY, serializeLearnedIcons([]))
    post({ type: 'learned', learned: [] })
  }

  const plan = computed<TeamImportPlan>(() => {
    const assignments: ShotAssignment[] = shots.value
      .filter((s): s is ImportShot & { reading: ScreenshotReading } => s.reading !== null)
      .map((s) => ({
        reading: s.reading,
        mapIndex: s.mapIndex,
        winner: s.winner,
        overrides: s.overrides,
        artifactOverrides: s.artifactOverrides,
      }))
    return buildTeamImportPlan(assignments, mode(), names)
  })

  return {
    shots,
    referenceStatus,
    names,
    learnedCount: computed(() => learned.value.length),
    plan,
    addFiles,
    removeShot,
    clear,
    setMap,
    setWinner,
    setHero,
    setLevel,
    setArtifact,
    saveNames,
    forgetLearned,
    ensureReferences,
  }
}

/* Drop the worker and the shots when the Teams page is left. */
export function disposeTeamImport(): void {
  worker?.terminate()
  worker = null
  pending.clear()
  for (const shot of shots.value) URL.revokeObjectURL(shot.thumb)
  shots.value = []
  referenceStatus.value = 'idle'
}
