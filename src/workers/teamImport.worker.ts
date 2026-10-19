/* Match-import worker: holds the reference tables and reads screenshots off
 * the main thread. Everything it runs is lib/import, which never touches a
 * canvas: the composable decodes images and hands over RGBA buffers, so the
 * same code runs under vitest and in the check script. One worker per page
 * visit; references arrive once, then each read is one message each way. */

import { buildArtifactTable } from '@/lib/import/artifacts'
import { fitBoard } from '@/lib/import/board'
import { readFormation } from '@/lib/import/formation'
import { prepareFrameRefs } from '@/lib/import/frames'
import { buildHeroTable } from '@/lib/import/heroes'
import { readScreenshot } from '@/lib/import/pipeline'
import { buildImportHeroTable } from '@/lib/import/references'
import { isReplayFrame, prepareArena, readReplay } from '@/lib/import/replay'
import { findTabs } from '@/lib/import/strip'
import {
  isFormationReading,
  type ArenaRef,
  type LearnedIcon,
  type PortraitRef,
  type ReferenceSet,
  type RgbaImage,
  type ScreenshotReading,
} from '@/lib/import/types'

export interface ReferenceImages {
  // In FRAME_NAMES order.
  frames: RgbaImage[]
  portraits: PortraitRef[]
  artifacts: { artifactId: number; image: RgbaImage }[]
  // Phantimals and companions with art of their own, by unit id.
  units: PortraitRef[]
  learned: LearnedIcon[]
  // The Supreme League arena that places replay frames.
  arena: RgbaImage
}

// A result screen, a formation panel, or a paused replay frame.
export type ShotKind = 'result' | 'formation' | 'replay'

export type TeamImportRequest =
  | ({ type: 'references' } & ReferenceImages)
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage; kind: ShotKind }
  // Which kind a screenshot is: a formation panel when a whole board is found
  // in it, else a replay frame (where `replay` allows one) when it has no
  // result tabs and the arena matches it, else a result screen. It needs only
  // the arena, so a second worker answers while this one reads.
  | { type: 'arena'; image: RgbaImage }
  | { type: 'sort'; id: string; image: RgbaImage; replay: boolean }

export type TeamImportResponse =
  | { type: 'ready' }
  | { type: 'reading'; id: string; reading: ScreenshotReading }
  | { type: 'sorted'; id: string; kind: ShotKind }
  | { type: 'error'; id: string | null; message: string }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin; the worker's takes a transfer list.
const scope = self as unknown as {
  postMessage(message: TeamImportResponse, transfer?: Transferable[]): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<TeamImportRequest>) => void,
  ): void
}

let refs: ReferenceSet | null = null
let portraits: ReferenceImages['portraits'] = []
// From the references in the reader, from its own message in the sorter.
let arena: ArenaRef | null = null

const sortKind = (image: RgbaImage, replay: boolean): ShotKind => {
  if (fitBoard(image)) return 'formation'
  if (replay && arena && !findTabs(image) && isReplayFrame(image, arena)) return 'replay'
  return 'result'
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
      scope.postMessage({ type: 'sorted', id: msg.id, kind: sortKind(msg.image, msg.replay) })
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
      arena = prepareArena(msg.arena)
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
    if (!refs || !arena) {
      scope.postMessage({ type: 'error', id, message: 'references not loaded' })
      return
    }
    const reading =
      msg.kind === 'formation'
        ? readFormation(msg.image, refs)
        : msg.kind === 'replay'
          ? readReplay(msg.image, arena)
          : readScreenshot(msg.image, refs)
    scope.postMessage({ type: 'reading', id: msg.id, reading }, transferablesOf(reading))
  } catch (error) {
    scope.postMessage({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
