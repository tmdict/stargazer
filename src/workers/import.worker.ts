/* Screenshot import worker: holds the reference tables and reads screenshots
 * off the main thread, each kind with its own reader. Everything it runs is
 * lib/import, which never touches a canvas: the composable decodes images and
 * hands over RGBA buffers, so the same code runs under vitest and in offline
 * checks. The references arrive in two parts, each once per worker (lib/import/
 * kinds): the hero part every kind needs, and the match part the match screens
 * add. A page visit runs one or more readers, and one more worker that holds
 * only the arena and sorts the screenshots added. */

import { prepareFrameRefs } from '@/lib/import/card/frames'
import type { HeroTable, LearnedIcon, PortraitRef } from '@/lib/import/card/types'
import type { RgbaImage } from '@/lib/import/core/types'
import {
  isMatchupReading,
  isRosterReading,
  partsOf,
  type ImportKind,
  type ImportReading,
  type ReferencePart,
} from '@/lib/import/kinds'
import { buildBoardTable, buildImportHeroTable, buildUnitTable } from '@/lib/import/references'
import { readFormation } from '@/lib/import/screens/formation/formation'
import { isFormationReading } from '@/lib/import/screens/formation/types'
import { buildArtifactTable } from '@/lib/import/screens/match/artifacts'
import type { ReferenceSet } from '@/lib/import/screens/match/types'
import { readMatchup } from '@/lib/import/screens/matchup/matchup'
import { prepareArena, readReplay } from '@/lib/import/screens/replay/replay'
import type { ArenaRef } from '@/lib/import/screens/replay/types'
import { readScreenshot } from '@/lib/import/screens/result/result'
import { readRoster } from '@/lib/import/screens/roster/roster'
import { sortScreenshot } from '@/lib/import/sort'

export interface HeroReferences {
  // In FRAME_NAMES order.
  frames: RgbaImage[]
  portraits: PortraitRef[]
  learned: LearnedIcon[]
}

export interface MatchReferences {
  artifacts: { artifactId: number; image: RgbaImage }[]
  // Phantimals and companions, by unit id, with their outfits.
  units: PortraitRef[]
  // The heroes a board draws with a picture of their own (Elijah alone), with
  // its outfits, by hero id.
  board: PortraitRef[]
  // The Supreme League arena that places replay frames; null when it failed
  // to load, and replay frames then fail to read.
  arena: RgbaImage | null
}

export type ImportRequest =
  | ({ type: 'heroes' } & HeroReferences)
  | ({ type: 'match' } & MatchReferences)
  | { type: 'learned'; learned: LearnedIcon[] }
  | { type: 'read'; id: string; image: RgbaImage; kind: ImportKind }
  // Sorting needs only the arena, so a second worker answers while this one reads.
  | { type: 'arena'; image: RgbaImage }
  | { type: 'sort'; id: string; image: RgbaImage; replay: boolean }

export type ImportResponse =
  | { type: 'ready'; part: ReferencePart }
  | { type: 'reading'; id: string; reading: ImportReading }
  | { type: 'sorted'; id: string; kind: ImportKind | null }
  // `part`: the part whose tables failed to build, for an error of no screenshot.
  | { type: 'error'; id: string | null; part?: ReferencePart; message: string }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin; the worker's takes a transfer list.
const scope = self as unknown as {
  postMessage(message: ImportResponse, transfer?: Transferable[]): void
  addEventListener(type: 'message', listener: (event: MessageEvent<ImportRequest>) => void): void
}

let card: Pick<ReferenceSet, 'frames' | 'heroes'> | null = null
let match: Pick<ReferenceSet, 'artifacts' | 'units'> | null = null
let portraits: PortraitRef[] = []
// The board's own pictures as the match part sent them, and the board table
// built from them and the portraits when a formation shot is first read: most
// of a second and tens of megabytes, which no other kind needs.
let boardPictures: PortraitRef[] = []
let board: HeroTable | null = null
// The learned faces as last sent, for the next read to rebuild the hero table
// with. A rebuild takes most of a second, and a review can send correction
// after correction while screenshots still wait to be read.
let learnedSince: LearnedIcon[] | null = null
// From the match part in a reader, from its own message in the sorter.
let arena: ArenaRef | null = null

const has = (part: ReferencePart): boolean => (part === 'heroes' ? card !== null : match !== null)

// The reader for each kind of screenshot; a replay frame needs only the arena.
const readers: Record<ImportKind, (image: RgbaImage) => ImportReading> = {
  result: (image) => readScreenshot(image, { ...card!, ...match! }),
  formation: (image) => {
    board ??= buildBoardTable(portraits, boardPictures)
    return readFormation(image, { ...card!, ...match!, board })
  },
  replay: (image) => {
    if (!arena) throw new Error('arena not loaded')
    return readReplay(image, arena)
  },
  roster: (image) => readRoster(image, card!),
  matchup: (image) => readMatchup(image, { ...card!, ...match! }),
}

const transferablesOf = (reading: ImportReading): Transferable[] => {
  const out: Transferable[] = []
  if (isRosterReading(reading)) {
    for (const slot of reading.slots) {
      if (slot.cell) out.push(slot.cell.card.data.buffer, slot.cell.descriptor.buffer)
    }
    return out
  }
  if (isMatchupReading(reading)) {
    for (const panel of reading.panels) {
      for (const team of Object.values(panel)) {
        for (const cell of team.cards ?? []) out.push(cell.card.data.buffer, cell.descriptor.buffer)
        out.push(team.artifact.card.data.buffer)
      }
    }
    return out
  }
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
  const part: ReferencePart | undefined =
    msg.type === 'heroes' || msg.type === 'match' ? msg.type : undefined
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
    if (msg.type === 'heroes') {
      portraits = msg.portraits
      board = null
      card = {
        frames: prepareFrameRefs(msg.frames),
        heroes: buildImportHeroTable(portraits, msg.learned),
      }
      learnedSince = null
      scope.postMessage({ type: 'ready', part: 'heroes' })
      return
    }
    if (msg.type === 'match') {
      match = { artifacts: buildArtifactTable(msg.artifacts), units: buildUnitTable(msg.units) }
      boardPictures = msg.board
      board = null
      arena = msg.arena ? prepareArena(msg.arena) : null
      scope.postMessage({ type: 'ready', part: 'match' })
      return
    }
    if (msg.type === 'learned') {
      // Before the tables exist the pending hero part carries the current list
      // itself.
      if (card) learnedSince = msg.learned
      return
    }
    if (!partsOf(msg.kind).every(has)) {
      scope.postMessage({ type: 'error', id, message: 'references not loaded' })
      return
    }
    if (card && learnedSince) {
      const next = learnedSince
      learnedSince = null
      card.heroes = buildImportHeroTable(portraits, next)
    }
    const reading = readers[msg.kind](msg.image)
    scope.postMessage({ type: 'reading', id: msg.id, reading }, transferablesOf(reading))
  } catch (error) {
    scope.postMessage({
      type: 'error',
      id,
      ...(part ? { part } : {}),
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
