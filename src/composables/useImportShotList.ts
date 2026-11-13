/* What the roster and matchup imports do alike around their screenshots: the
 * list itself (adding, removing, clearing, a level set on its cards) and the
 * screenshot drawn again with outlines for the lightbox. Each import keeps its
 * own readings, corrections and plan. */

import { getCurrentScope, onScopeDispose, type Ref } from 'vue'

import {
  useImportEngine,
  type EngineShot,
  type ImportEngine,
  type IntakeResult,
  type ShotSession,
} from '@/composables/useImportEngine'
import type { ImportKind } from '@/lib/import/kinds'
import type { CellOverride } from '@/lib/import/review'

// A card, or a team's artifact, of a screenshot, as the review's edits name it.
export interface ShotRef {
  shotId: string
  key: string
}

interface ListShot extends EngineShot {
  // Object URLs: the file, for the card thumbnail, and the screenshot with
  // its outlines, once read.
  thumb: string
  marked: string | null
  overrides: Record<string, CellOverride>
}

// The fields every listed shot starts with.
export const newShotFields = (file: File) => ({
  name: file.name,
  size: file.size,
  thumb: URL.createObjectURL(file),
  marked: null,
  status: 'waiting' as const,
  error: null,
  reading: null,
  overrides: {},
  cards: {},
})

export interface ImportShotList {
  engine: ImportEngine
  addFiles: (files: File[]) => Promise<IntakeResult>
  removeShot: (id: string) => void
  clearImport: () => void
  setLevel: (cards: readonly ShotRef[], field: 'paragon' | 'refinement', level: number) => void
}

/* The list of an import that reads one kind of screenshot. `make` gives the
 * import's shot for a file. */
export function useImportShotList<K extends ImportKind, S extends ListShot & { kind: K }>(
  shots: Ref<S[]>,
  session: ShotSession,
  kind: K,
  make: (file: File) => S,
): ImportShotList {
  const engine = useImportEngine(session)

  const findShot = (id: string): S | undefined => shots.value.find((s) => s.id === id)

  const dropUrls = (shot: S): void => {
    URL.revokeObjectURL(shot.thumb)
    if (shot.marked) URL.revokeObjectURL(shot.marked)
  }

  const clearImport = (): void => {
    engine.release()
    shots.value.forEach(dropUrls)
    shots.value = []
  }
  if (getCurrentScope()) onScopeDispose(clearImport)

  // One the sorter finds to be another import's is refused and counted by
  // kind; one it cannot place is read as the list's kind. The sorter may tell
  // a replay frame, so that one is turned away too.
  const addFiles = (files: File[]): Promise<IntakeResult> =>
    engine.addFiles(files, {
      replay: () => true,
      place: (sorted) => (sorted && sorted !== kind ? { refused: sorted } : { kind }),
      add: (file) => {
        const shot = make(file)
        shots.value = [...shots.value, shot]
        return shot
      },
    })

  const removeShot = (id: string): void => {
    const shot = findShot(id)
    if (shot) dropUrls(shot)
    engine.dropShot(id)
    shots.value = shots.value.filter((s) => s.id !== id)
  }

  // A level set for a card is written to each of its readings.
  const setLevel = (
    cards: readonly ShotRef[],
    field: 'paragon' | 'refinement',
    level: number,
  ): void => {
    for (const card of cards) {
      const shot = findShot(card.shotId)
      if (shot) shot.overrides[card.key] = { ...shot.overrides[card.key], [field]: level }
    }
  }

  return { engine, addFiles, removeShot, clearImport, setLevel }
}

// What was read is outlined in yellow; what was not (cut by the scroll,
// covered, out of view or empty), in grey and dashed, so a part counted as cut
// off can be found on the screenshot.
const READ_COLOUR = '#ffd54a'
const SKIPPED_COLOUR = '#b8b8b8'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

// Draws on the screenshot from boxes in the reader's pixels.
export interface ShotPen {
  outline: (box: Box, read: boolean) => void
  // A label inside the top left corner of `at`.
  label: (text: string, at: { x: number; y: number }, read: boolean) => void
}

/* The screenshot with what `draw` outlines and labels on it, as a JPEG; null
 * when it cannot be drawn. The reader's boxes are in the decoded image's
 * pixels, which a capture wider than `maxWidth` was drawn down to. Lines are
 * one unit thick, a `fine`th of the picture's width, and labels `text` units
 * tall. */
export const markShot = async (
  thumb: string,
  maxWidth: number,
  { fine, text }: { fine: number; text: number },
  draw: (pen: ShotPen) => void,
): Promise<Blob | null> => {
  const image = new Image()
  image.src = thumb
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)
  const scale = image.naturalWidth / Math.min(image.naturalWidth, maxWidth)
  const unit = Math.max(2, Math.round(canvas.width / fine))
  ctx.font = `700 ${unit * text}px sans-serif`
  ctx.textBaseline = 'top'
  draw({
    outline: ({ x, y, w, h }, read) => {
      ctx.lineWidth = unit
      ctx.strokeStyle = read ? READ_COLOUR : SKIPPED_COLOUR
      ctx.setLineDash(read ? [] : [unit * 3, unit * 2])
      ctx.strokeRect(x * scale, y * scale, w * scale, h * scale)
    },
    label: (label, at, read) => {
      const x = at.x * scale + unit
      const y = at.y * scale + unit
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(x, y, ctx.measureText(label).width + unit * 2, unit * (text + 2))
      ctx.fillStyle = read ? READ_COLOUR : SKIPPED_COLOUR
      ctx.fillText(label, x + unit, y + unit)
    },
  })
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}
