// A Trial unit is an Honor Duel unit that may repeat on a team: a hero or a
// creature a Trial Card brings. Each copy on a board takes an id band of its
// own above the synergy band, laid out like the base namespace (the copy at
// its band's start + baseId, companions it spawns at + N * 10000), so a copy's
// skill state, companions and values never mix with another copy's. Copy
// numbers are board-local: no format carries them, and a reader hands them out
// again.
import { COMPANION_ID_OFFSET, TRIAL_ID_OFFSET } from './unitIds'

const TRIAL_BAND_SIZE = 100000

// Five a side: one pool for the whole board, so a copy moved to the other team
// never meets its own number there.
export const TRIAL_COPIES = 10

export function inTrialBand(id: number): boolean {
  return id >= TRIAL_ID_OFFSET && id < TRIAL_ID_OFFSET + TRIAL_COPIES * TRIAL_BAND_SIZE
}

// `copy` is 1-based.
export function toTrialId(baseId: number, copy: number): number {
  return TRIAL_ID_OFFSET + (copy - 1) * TRIAL_BAND_SIZE + baseId
}

function trialCopyOf(id: number): number {
  return Math.floor((id - TRIAL_ID_OFFSET) / TRIAL_BAND_SIZE) + 1
}

// The id inside its copy's band: the hero's base id, or N * 10000 + base for a
// companion.
export function trialBandLocal(id: number): number {
  return (id - TRIAL_ID_OFFSET) % TRIAL_BAND_SIZE
}

// The lowest copy number none of a board's units holds, or null when all are taken.
export function freeTrialCopy(unitIds: readonly number[]): number | null {
  const taken = new Set(unitIds.filter(inTrialBand).map(trialCopyOf))
  for (let copy = 1; copy <= TRIAL_COPIES; copy++) {
    if (!taken.has(copy)) return copy
  }
  return null
}

// The copy itself, as opposed to a companion it spawned.
export function isTrialHeroId(id: number): boolean {
  return inTrialBand(id) && trialBandLocal(id) < COMPANION_ID_OFFSET
}

// A pick of a Trial unit names the unit and the tier of the card it comes
// from, in a band above every copy's. It is a picker's id and never stands on
// a board: the board places a free copy of the unit at that tier.
const TRIAL_PICK_OFFSET = TRIAL_ID_OFFSET + TRIAL_COPIES * TRIAL_BAND_SIZE

// `tier` is a position in the mode's tier list.
export function toTrialPick(baseId: number, tier: number): number {
  return TRIAL_PICK_OFFSET + tier * TRIAL_BAND_SIZE + baseId
}

export function trialPickOf(id: number): { baseId: number; tier: number } | null {
  if (id < TRIAL_PICK_OFFSET) return null
  const local = id - TRIAL_PICK_OFFSET
  return { baseId: local % TRIAL_BAND_SIZE, tier: Math.floor(local / TRIAL_BAND_SIZE) }
}
