/* The review rules shared by every import's plan: a reviewer's correction of
 * one card, the state the review shows for it, and the hero and levels the
 * card contributes once reviewed. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import type { HeroReading } from './card/types'

export interface CellOverride {
  characterId?: number | null
  paragon?: number
  refinement?: number
}

export type CellState = 'sure' | 'review' | 'paragon' | 'refinement' | 'none' | 'duplicate'

export type ReviewPart = 'hero' | 'paragon' | 'refinement'

/* The parts of a cell the review asks to confirm: the hero, the paragon and
 * the refinement, each until read surely or edited (a doubtful frame match puts
 * the whole card in doubt, levels included). A cell removed in review, or that
 * nobody recognised or picked, has none to confirm. */
export const doubtfulParts = (cell: HeroReading, override: CellOverride = {}): ReviewPart[] => {
  if (override.characterId === null) return []
  if (override.characterId === undefined && !cell.recognised) return []
  const parts: ReviewPart[] = []
  if (override.characterId === undefined && !cell.sure) parts.push('hero')
  if (override.paragon === undefined && !cell.paragon.sure) parts.push('paragon')
  if (override.refinement === undefined && !cell.refinement.sure) parts.push('refinement')
  return parts
}

// The state a cell shows while a part is its first in doubt.
export const PART_STATE: Record<ReviewPart, CellState> = {
  hero: 'review',
  paragon: 'paragon',
  refinement: 'refinement',
}

/* The state the review shows for a cell: `none` when nobody recognised or
 * picked it, else its first doubtful part, else `sure`. */
export const cellState = (cell: HeroReading, override: CellOverride = {}): CellState => {
  if (override.characterId === null) return 'sure'
  if (override.characterId === undefined && !cell.recognised) return 'none'
  const first = doubtfulParts(cell, override)[0]
  return first ? PART_STATE[first] : 'sure'
}

/* The hero a cell contributes: the override when one was made (null =
 * removed), else the top candidate. */
export const reviewedCharacterId = (
  cell: HeroReading | undefined,
  override: CellOverride | undefined,
): number | null => {
  if (override && override.characterId !== undefined) return override.characterId
  return cell?.recognised ? (cell.candidates[0]?.characterId ?? null) : null
}

/* The levels a cell contributes, each the override when one was made, else
 * the reading. */
export const reviewedAttrs = (
  cell: HeroReading | undefined,
  override: CellOverride = {},
): AttrRecord => {
  const attrs: AttrRecord = {}
  const paragon = override.paragon ?? cell?.paragon.level ?? 0
  const refinement = override.refinement ?? cell?.refinement.level ?? 0
  if (paragon) attrs[ATTR_PARAGON] = paragon
  if (refinement) attrs[ATTR_REFINEMENT] = refinement
  return attrs
}
