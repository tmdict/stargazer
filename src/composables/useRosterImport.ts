/* Roster screenshot import: file intake of the game's hero roster screen, the
 * review's corrections beside each reading, and the roster they make
 * (lib/rosterImport). The import engine (useImportEngine) decodes and reads
 * the screenshots, several at once. Module-level state like useTeamImport: the
 * shots belong to one opening of the modal (clearImport), and the modal holds
 * the engine for the page visit, the shots dropped with it when the page is
 * left. */

import { computed, getCurrentScope, onScopeDispose, reactive, ref, type ComputedRef } from 'vue'

import {
  imageToDataUrl,
  useImportEngine,
  type ImportEngine,
  type IntakeResult,
  type ShotError,
  type ShotSession,
  type ShotStatus,
} from '@/composables/useImportEngine'
import { isRosterReading } from '@/lib/import/kinds'
import type { CellOverride } from '@/lib/import/review'
import { ROSTER_MAX_WIDTH } from '@/lib/import/screens/roster/roster'
import type { RosterReading } from '@/lib/import/screens/roster/types'
import { buildRosterImportPlan, slotKey, type RosterImportPlan } from '@/lib/rosterImport'

export interface RosterImportShot {
  id: string
  kind: 'roster'
  name: string
  size: number
  // Object URL of the file, for the card thumbnail.
  thumb: string
  // Object URL of the screenshot with every slot outlined and numbered, once
  // read.
  marked: string | null
  status: ShotStatus
  error: ShotError | null
  reading: RosterReading | null
  // By slot key.
  overrides: Record<string, CellOverride>
  // Data URLs of each card read, by slot key.
  cards: Record<string, string>
}

// A card of a screenshot, as the review's edits name it.
export interface CardRef {
  shotId: string
  key: string
}

const shots = ref<RosterImportShot[]>([])
let nextId = 1
// Shots belong to one opening of the modal; clearImport ends it, and an
// addFiles still sorting or decoding for that opening stops adding.
let opening = 0
// The cards read are outlined in yellow; a slot cut by the scroll or covered,
// and an empty one, in grey and dashed, so a card counted as cut off can be
// found on the screenshot.
const READ_COLOUR = '#ffd54a'
const SKIPPED_COLOUR = '#b8b8b8'

const findShot = (id: string): RosterImportShot | undefined => shots.value.find((s) => s.id === id)

/* The screenshot as the review numbers it: every slot outlined with its key,
 * H1 to H5 for the Hands of Resonance and row.col down the grid. Boxes are in
 * the decoded image's pixels, which a wide capture was drawn down to. */
const markSlots = async (shot: RosterImportShot, reading: RosterReading): Promise<void> => {
  const image = new Image()
  image.src = shot.thumb
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(image, 0, 0)
  const scale = image.naturalWidth / Math.min(image.naturalWidth, ROSTER_MAX_WIDTH)
  const unit = Math.max(2, Math.round(canvas.width / 600))
  ctx.font = `700 ${unit * 7}px sans-serif`
  ctx.textBaseline = 'top'
  for (const slot of reading.slots) {
    const { x, y, w, h } = slot.box
    const key = slotKey(slot).toUpperCase()
    const colour = slot.cell ? READ_COLOUR : SKIPPED_COLOUR
    ctx.lineWidth = unit
    ctx.strokeStyle = colour
    ctx.setLineDash(slot.cell ? [] : [unit * 3, unit * 2])
    ctx.strokeRect(x * scale, y * scale, w * scale, h * scale)
    const label = {
      x: x * scale + unit,
      y: y * scale + unit,
      w: ctx.measureText(key).width + unit * 2,
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(label.x, label.y, label.w, unit * 9)
    ctx.fillStyle = colour
    ctx.fillText(key, label.x + unit, label.y + unit)
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
  // Removed, or the import closed, while it was drawn.
  if (!blob || findShot(shot.id) !== shot) return
  shot.marked = URL.createObjectURL(blob)
}

const applyReading = (shot: RosterImportShot, reading: RosterReading): void => {
  shot.reading = reading
  for (const slot of reading.slots) {
    if (slot.cell) shot.cards[slotKey(slot)] = imageToDataUrl(slot.cell.card)
  }
  void markSlots(shot, reading).catch(() => {
    // The plain screenshot still shows in the lightbox.
  })
}

const session: ShotSession = {
  kinds: ['roster'],
  shots: () => shots.value,
  apply: (id, reading) => {
    const shot = findShot(id)
    // Its shots are roster screens, whose reader gives a roster's reading.
    if (shot && isRosterReading(reading)) applyReading(shot, reading)
  },
}

const dropUrls = (shot: RosterImportShot): void => {
  URL.revokeObjectURL(shot.thumb)
  if (shot.marked) URL.revokeObjectURL(shot.marked)
}

export function useRosterImport(): {
  shots: typeof shots
  referenceStatus: ImportEngine['referenceStatus']
  learnedCount: ComputedRef<number>
  plan: ComputedRef<RosterImportPlan>
  // The screenshots read and to read, while any is still being added or read.
  progress: ComputedRef<{ read: number; total: number } | null>
  addFiles: (files: File[]) => Promise<IntakeResult>
  removeShot: (id: string) => void
  clearImport: () => void
  setHero: (cards: readonly CardRef[], characterId: number | null) => void
  setLevel: (cards: readonly CardRef[], field: 'paragon' | 'refinement', level: number) => void
  confirmAll: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  const engine = useImportEngine(session)

  /* End an opening of the modal: drop every shot with its review edits and
   * waiting read, so the next opening starts fresh. The engine and the learned
   * faces stay for the page visit. */
  const clearImport = (): void => {
    opening++
    for (const shot of shots.value) {
      engine.dropShot(shot.id)
      dropUrls(shot)
    }
    shots.value = []
  }
  // Leaving the page unmounts the modal, and its shots go with the engine.
  if (getCurrentScope()) onScopeDispose(clearImport)

  // One the sorter finds to be another import's is refused and counted by
  // kind; one it cannot place is read as a roster.
  const addFiles = (files: File[]): Promise<IntakeResult> => {
    const mine = opening
    return engine.addFiles(files, {
      current: () => mine === opening,
      replay: () => true,
      place: (sorted) =>
        sorted && sorted !== 'roster' ? { refused: sorted } : { kind: 'roster' as const },
      add: (file) => {
        const shot = reactive({
          id: `roster-${nextId++}`,
          kind: 'roster',
          name: file.name,
          size: file.size,
          thumb: URL.createObjectURL(file),
          marked: null,
          status: 'reading',
          error: null,
          reading: null,
          overrides: {},
          cards: {},
        }) as RosterImportShot
        shots.value = [...shots.value, shot]
        return shot
      },
    })
  }

  const removeShot = (id: string): void => {
    const shot = findShot(id)
    if (shot) dropUrls(shot)
    engine.dropShot(id)
    shots.value = shots.value.filter((s) => s.id !== id)
  }

  const cellOf = (card: CardRef) => {
    const shot = findShot(card.shotId)
    const slot = shot?.reading?.slots.find((s) => s.cell && slotKey(s) === card.key)
    return shot && slot?.cell && slot.frame ? { shot, cell: slot.cell, frame: slot.frame } : null
  }

  /* Take the cards for a hero, or for none. A correction of a card the reader
   * was unsure of teaches its face, when a paragon frame placed it surely,
   * whatever its level (a card below S+ never teaches, its face cut from a
   * guessed box); picking the reader's own top candidate, or no hero, takes
   * back what it was taught. The cards given are one card seen again, so the
   * first teaches and the others take back what each was taught on its own,
   * before they were one. */
  const setHero = (cards: readonly CardRef[], characterId: number | null): void => {
    let first = true
    for (const card of cards) {
      const found = cellOf(card)
      if (!found) continue
      const { shot, cell, frame } = found
      shot.overrides[card.key] = { ...shot.overrides[card.key], characterId }
      if (cell.sure || frame.family !== 'paragon' || !frame.sure) continue
      const teach = first && characterId !== null && cell.candidates[0]?.characterId !== characterId
      engine.learnFace(teach ? characterId : null, cell.descriptor)
      first = false
    }
  }

  // A level set for a hero is written to each of its cards.
  const setLevel = (
    cards: readonly CardRef[],
    field: 'paragon' | 'refinement',
    level: number,
  ): void => {
    for (const card of cards) {
      const shot = findShot(card.shotId)
      if (shot) shot.overrides[card.key] = { ...shot.overrides[card.key], [field]: level }
    }
  }

  const plan = computed(() =>
    buildRosterImportPlan(
      shots.value.flatMap((s) =>
        s.reading ? [{ id: s.id, reading: s.reading, overrides: s.overrides }] : [],
      ),
    ),
  )

  // Each doubtful part is confirmed as read, the hero being the reader's own
  // top candidate, so no face is taught.
  const confirmAll = (): void => {
    for (const entry of plan.value.confirmable) {
      for (const card of entry.cards) {
        for (const part of card.doubtful) {
          if (part === 'hero') setHero([card], entry.characterId)
          else setLevel([card], part, card[part])
        }
      }
    }
  }

  const progress = computed(() => {
    const waiting = engine.adding.value + shots.value.filter((s) => s.status === 'reading').length
    const total = shots.value.length + engine.adding.value
    return waiting ? { read: total - waiting, total } : null
  })

  return {
    shots,
    referenceStatus: engine.referenceStatus,
    learnedCount: engine.learnedCount,
    plan,
    progress,
    addFiles,
    removeShot,
    clearImport,
    setHero,
    setLevel,
    confirmAll,
    forgetLearned: engine.forgetLearned,
    ensureReferences: engine.ensureReferences,
  }
}
