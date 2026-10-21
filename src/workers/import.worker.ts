/* Screenshot import worker: holds the reference tables and reads screenshots
 * off the main thread, each kind with its own reader. Everything it runs is
 * lib/import, which never touches a canvas: the composable decodes images and
 * hands over RGBA buffers, so the same code runs under vitest and in offline
 * checks. Two run per page visit: one reads, its references arriving once and
 * then each read one message each way; the other holds only the arena and
 * sorts pastes. */

import { prepareFrameRefs } from '@/lib/import/card/frames'
import { buildHeroTable } from '@/lib/import/card/heroes'
import type { LearnedIcon, PortraitRef } from '@/lib/import/card/types'
import type { RgbaImage } from '@/lib/import/core/types'
import { buildImportHeroTable } from '@/lib/import/references'
import { readFormation } from '@/lib/import/screens/formation/formation'
import { isFormationReading } from '@/lib/import/screens/formation/types'
import { buildArtifactTable } from '@/lib/import/screens/match/artifacts'
import type { ReferenceSet, ScreenshotReading, ShotKind } from '@/lib/import/screens/match/types'
import { prepareArena, readReplay } from '@/lib/import/screens/replay/replay'
import type { ArenaRef } from '@/lib/import/screens/replay/types'
import { readScreenshot } from '@/lib/import/screens/result/result'
import { sortScreenshot } from '@/lib/import/sort'

export interface ReferenceImages {
  // In FRAME_NAMES order.
  frames: RgbaImage[]
  portraits: PortraitRef[]
  artifacts: { artifactId: number; image: RgbaImage }[]
  // Phantimals and companions with art of their own, by unit id.
  units: PortraitRef[]
  learned: LearnedIcon[]
  // The Supreme League arena that places replay frames; null when it failed
  // to load, and replay frames then fail to read.
  arena: RgbaImage | null
}

export type ImportRequest =
  | ({ type: 'references' } & ReferenceImages)
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage; kind: ShotKind }
  // Sorting needs only the arena, so a second worker answers while this one reads.
  | { type: 'arena'; image: RgbaImage }
  | { type: 'sort'; id: string; image: RgbaImage; replay: boolean }

export type ImportResponse =
  | { type: 'ready' }
  | { type: 'reading'; id: string; reading: ScreenshotReading }
  | { type: 'sorted'; id: string; kind: ShotKind }
  | { type: 'error'; id: string | null; message: string }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin; the worker's takes a transfer list.
const scope = self as unknown as {
  postMessage(message: ImportResponse, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<ImportRequest>) => void): void
}

let refs: ReferenceSet | null = null
let portraits: ReferenceImages['portraits'] = []
// From the references in the reader, from its own message in the sorter.
let arena: ArenaRef | null = null

// The reader for each kind of screenshot; a replay frame needs only the arena.
const readers: Record<ShotKind, (image: RgbaImage, refs: ReferenceSet) => ScreenshotReading> = {
  result: readScreenshot,
  formation: readFormation,
  replay: (image) => {
    if (!arena) throw new Error('arena not loaded')
    return readReplay(image, arena)
  },
}

const transferablesOf = (reading: ScreenshotReading): Transferable[] => {
  const out: Transferable[] = []
  for (const side of Object.values(reading.sides)) {
    for (const cell of side) {
      out.push(cell.card.data.buffer, cell.descriptor.buffer)
    }
  }
  for (const artifact of Object.values(reading.artifacts)) {
    if (artifact) out.push(artifact.card.data.buffer)
  }
  if (isFormationReading(reading)) {
    for (const unit of reading.units) out.push(unit.card.data.buffer)
  }
  return out
}

scope.addEventListener('message', (event) => {
  const msg = event.data
  const id = msg.type === 'read' || msg.type === 'sort' ? msg.id : null
  try {
    if (msg.type === 'sort') {
      const kind = sortScreenshot(msg.image, msg.replay ? arena : null)
      scope.postMessage({ type: 'sorted', id: msg.id, kind })
      return
    }
    if (msg.type === 'arena') {
      arena = prepareArena(msg.image)
      return
    }
    if (msg.type === 'references') {
      portraits = msg.portraits
      refs = {
        frames: prepareFrameRefs(msg.frames),
        heroes: buildImportHeroTable(portraits, msg.learned),
        artifacts: buildArtifactTable(msg.artifacts),
        units: buildHeroTable(msg.units),
      }
      arena = msg.arena ? prepareArena(msg.arena) : null
      scope.postMessage({ type: 'ready' })
      return
    }
    if (msg.type === 'learned') {
      // Before the tables exist the pending references post carries the
      // current list itself, so there is nothing to rebuild or to fail.
      if (refs) {
        refs.heroes = buildImportHeroTable(portraits, msg.learned)
        scope.postMessage({ type: 'ready' })
      }
      return
    }
    if (!refs) {
      scope.postMessage({ type: 'error', id, message: 'references not loaded' })
      return
    }
    const reading = readers[msg.kind](msg.image, refs)
    scope.postMessage({ type: 'reading', id: msg.id, reading }, transferablesOf(reading))
  } catch (error) {
    scope.postMessage({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
