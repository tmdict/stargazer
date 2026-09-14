/* Match-import worker: holds the reference tables and reads screenshots off
 * the main thread. Everything it runs is lib/import, which never touches a
 * canvas: the composable decodes images and hands over RGBA buffers, so the
 * same code runs under vitest and in the check script. One worker per page
 * visit; references arrive once, then each read is one message each way. */

import { buildArtifactTable } from '@/lib/import/artifacts'
import { prepareFrameRefs } from '@/lib/import/frames'
import { readScreenshot } from '@/lib/import/pipeline'
import { buildImportHeroTable } from '@/lib/import/references'
import type {
  LearnedIcon,
  PortraitRef,
  ReferenceSet,
  RgbaImage,
  ScreenshotReading,
} from '@/lib/import/types'

export interface ReferenceImages {
  // In FRAME_NAMES order.
  frames: RgbaImage[]
  portraits: PortraitRef[]
  artifacts: { artifactId: number; image: RgbaImage }[]
  learned: LearnedIcon[]
}

export type TeamImportRequest =
  | ({ type: 'references' } & ReferenceImages)
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage }

export type TeamImportResponse =
  | { type: 'ready' }
  | { type: 'reading'; id: string; reading: ScreenshotReading }
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

const transferablesOf = (reading: ScreenshotReading): Transferable[] => {
  const out: Transferable[] = []
  for (const side of Object.values(reading.sides)) {
    for (const cell of side) {
      out.push(cell.card.data.buffer, cell.descriptor.buffer)
    }
  }
  return out
}

scope.addEventListener('message', (event) => {
  const msg = event.data
  const id = msg.type === 'read' ? msg.id : null
  try {
    if (msg.type === 'references') {
      portraits = msg.portraits
      refs = {
        frames: prepareFrameRefs(msg.frames),
        heroes: buildImportHeroTable(portraits, msg.learned),
        artifacts: buildArtifactTable(msg.artifacts),
      }
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
    const reading = readScreenshot(msg.image, refs)
    scope.postMessage({ type: 'reading', id: msg.id, reading }, transferablesOf(reading))
  } catch (error) {
    scope.postMessage({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
