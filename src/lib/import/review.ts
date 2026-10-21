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

/* The state the review shows for a cell. A cell removed in review has nothing
 * left to check; one nobody recognised or picked is `none`; otherwise the
 * hero, the paragon and the refinement each stand once read surely or edited,
 * asked about in that order (a doubtful frame match puts the whole card in
 * doubt, levels included). */
export const cellState = (cell: HeroReading, override: CellOverride = {}): CellState => {
  if (override.characterId === null) return 'sure'
  if (override.characterId === undefined && !cell.recognised) return 'none'
  const heroSure = override.characterId !== undefined || cell.sure
  const paragonSure = override.paragon !== undefined || cell.paragon.sure
  const refinementSure = override.refinement !== undefined || cell.refinement.sure
  if (!heroSure) return 'review'
  if (!paragonSure) return 'paragon'
  return refinementSure ? 'sure' : 'refinement'
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
