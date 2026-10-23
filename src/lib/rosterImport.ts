/* The roster import's plan: the cards of every roster screenshot, each with the
 * reviewer's correction beside it, merged into one roster with an entry per
 * hero, what the review asks about first, and what holds back Save. A roster
 * holds a hero once, so the hero is the key: the Hands of Resonance and the grid
 * are one pool, and the same card seen in two screenshots is one entry. The
 * plan is worked out again from the readings and corrections on every change,
 * so the screenshots give the same plan whichever is read first. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from './characters/attributes'
import type { HeroReading } from './import/card/types'
import {
  cellState,
  doubtfulParts,
  reviewedAttrs,
  reviewedCharacterId,
  type CellOverride,
  type CellState,
  type ReviewPart,
} from './import/review'
import type { FrameFamily, RosterReading, Slot } from './import/screens/roster/types'

/* A slot's key: h1 to h5 for the Hands of Resonance, row.col down the grid. */
export const slotKey = (slot: Slot): string =>
  slot.hands ? `h${slot.col + 1}` : `${slot.row + 1}.${slot.col + 1}`

export interface RosterShotInput {
  id: string
  reading: RosterReading
  // By slot key.
  overrides: Readonly<Record<string, CellOverride>>
}

// A card as reviewed: its reading, and the hero and levels it gives.
export interface RosterCard {
  shotId: string
  key: string
  cell: HeroReading
  family: FrameFamily
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  doubtful: ReviewPart[]
  edited: boolean
}

// What an entry asks about: a repeat with an unsure card, usually a misreading;
// cards that disagree on the hero's levels; the hero on two cards of one
// screenshot. The last two hold back Save.
export type EntryIssue = 'repeat' | 'levels' | 'twice'

export interface RosterEntry {
  characterId: number
  cards: RosterCard[]
  // The hero's levels; null while its cards disagree.
  paragon: number | null
  refinement: number | null
  issues: EntryIssue[]
  // Shown first: an issue, or a card left to check.
  check: boolean
}

export interface RosterImportPlan {
  // The heroes to check first, then the rest, each in hero id order.
  entries: RosterEntry[]
  // The heroes the review confirms as read in one go: a card left to check and
  // no issue (an issue is the reviewer's to settle).
  confirmable: RosterEntry[]
  // Cards no hero is taken for yet.
  unnamed: RosterCard[]
  // What Save writes: each hero's levels, defaults left out.
  heroes: Record<string, AttrRecord>
  blocked: boolean
}

const BLOCKING: readonly EntryIssue[] = ['levels', 'twice']

const cardsOf = (shot: RosterShotInput): RosterCard[] =>
  shot.reading.slots.flatMap((slot) => {
    if (!slot.cell || !slot.frame) return []
    const key = slotKey(slot)
    const override = shot.overrides[key] ?? {}
    // Removed in review.
    if (override.characterId === null) return []
    const attrs = reviewedAttrs(slot.cell, override)
    return [
      {
        shotId: shot.id,
        key,
        cell: slot.cell,
        family: slot.frame.family,
        characterId: reviewedCharacterId(slot.cell, override),
        paragon: attrs[ATTR_PARAGON] ?? 0,
        refinement: attrs[ATTR_REFINEMENT] ?? 0,
        state: cellState(slot.cell, override),
        doubtful: doubtfulParts(slot.cell, override),
        edited: Object.keys(override).length > 0,
      },
    ]
  })

const only = (values: number[]): number | null => (new Set(values).size === 1 ? values[0]! : null)

export function buildRosterImportPlan(shots: readonly RosterShotInput[]): RosterImportPlan {
  const byHero = new Map<number, RosterCard[]>()
  const unnamed: RosterCard[] = []
  for (const shot of shots) {
    for (const card of cardsOf(shot)) {
      if (card.characterId === null) unnamed.push(card)
      else byHero.set(card.characterId, [...(byHero.get(card.characterId) ?? []), card])
    }
  }
  const entries = [...byHero].map(([characterId, cards]): RosterEntry => {
    const paragon = only(cards.map((c) => c.paragon))
    const refinement = only(cards.map((c) => c.refinement))
    const issues: EntryIssue[] = []
    if (cards.length > 1 && cards.some((c) => c.state === 'review')) issues.push('repeat')
    if (paragon === null || refinement === null) issues.push('levels')
    if (new Set(cards.map((c) => c.shotId)).size < cards.length) issues.push('twice')
    return {
      characterId,
      cards,
      paragon,
      refinement,
      issues,
      check: issues.length > 0 || cards.some((c) => c.state !== 'sure'),
    }
  })
  entries.sort((a, b) => Number(b.check) - Number(a.check) || a.characterId - b.characterId)
  const heroes: Record<string, AttrRecord> = {}
  for (const { characterId, paragon, refinement } of entries) {
    if (paragon === null || refinement === null) continue
    const levels: AttrRecord = {}
    if (paragon) levels[ATTR_PARAGON] = paragon
    if (refinement) levels[ATTR_REFINEMENT] = refinement
    heroes[characterId] = levels
  }
  return {
    entries,
    confirmable: entries.filter((e) => e.check && e.issues.length === 0),
    unnamed,
    heroes,
    blocked: entries.some((e) => e.issues.some((issue) => BLOCKING.includes(issue))),
  }
}
