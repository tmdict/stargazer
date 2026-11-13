/* Roster screenshot import: file intake of the game's hero roster screen, the
 * review's corrections beside each reading, and the roster they make
 * (lib/rosterImport). The import engine (useImportEngine) decodes and reads
 * the screenshots, several at once. Module-level state like useTeamImport: the
 * shots belong to one opening of the modal, and closing it (clearImport) drops
 * them and releases the engine. */

import { computed, reactive, ref, type ComputedRef } from 'vue'

import {
  imageToDataUrl,
  type ImportEngine,
  type ShotError,
  type ShotSession,
  type ShotStatus,
} from '@/composables/useImportEngine'
import {
  markShot,
  newShotFields,
  useImportShotList,
  type ImportShotList,
  type ShotRef,
} from '@/composables/useImportShotList'
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

const shots = ref<RosterImportShot[]>([])
let nextId = 1

const findShot = (id: string): RosterImportShot | undefined => shots.value.find((s) => s.id === id)

/* The screenshot as the review numbers it: every slot outlined with its key,
 * H1 to H5 for the Hands of Resonance and row.col down the grid. */
const markSlots = async (shot: RosterImportShot, reading: RosterReading): Promise<void> => {
  const blob = await markShot(shot.thumb, ROSTER_MAX_WIDTH, { fine: 600, text: 7 }, (pen) => {
    for (const slot of reading.slots) {
      pen.outline(slot.box, slot.cell !== null)
      pen.label(slotKey(slot).toUpperCase(), slot.box, slot.cell !== null)
    }
  })
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

export function useRosterImport(): Omit<ImportShotList, 'engine'> & {
  shots: typeof shots
  referenceStatus: ImportEngine['referenceStatus']
  learnedCount: ComputedRef<number>
  plan: ComputedRef<RosterImportPlan>
  progress: ImportEngine['progress']
  setHero: (cards: readonly ShotRef[], characterId: number | null) => void
  confirmAll: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  const { engine, ...list } = useImportShotList(
    shots,
    session,
    'roster',
    (file) =>
      reactive({
        id: `roster-${nextId++}`,
        kind: 'roster',
        ...newShotFields(file),
      }) as RosterImportShot,
  )
  const { setLevel } = list

  const cellOf = (card: ShotRef) => {
    const shot = findShot(card.shotId)
    const slot = shot?.reading?.slots.find((s) => s.cell && slotKey(s) === card.key)
    return shot && slot?.cell && slot.frame ? { shot, cell: slot.cell, frame: slot.frame } : null
  }

  /* Take the cards for a hero, or for none. The cards given are one card seen
   * again, and the correction teaches from those a paragon frame placed
   * surely, whatever its level (a card below S+ never teaches, its face cut
   * from a guessed box). */
  const setHero = (cards: readonly ShotRef[], characterId: number | null): void => {
    const found = cards.flatMap((card) => {
      const at = cellOf(card)
      return at ? [{ ...at, key: card.key }] : []
    })
    for (const { shot, key } of found) {
      shot.overrides[key] = { ...shot.overrides[key], characterId }
    }
    engine.learnCorrection(
      found.filter(({ frame }) => frame.family === 'paragon' && frame.sure).map(({ cell }) => cell),
      characterId,
    )
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

  return {
    shots,
    referenceStatus: engine.referenceStatus,
    learnedCount: engine.learnedCount,
    plan,
    progress: engine.progress,
    ...list,
    setHero,
    confirmAll,
    forgetLearned: engine.forgetLearned,
    ensureReferences: engine.ensureReferences,
  }
}
