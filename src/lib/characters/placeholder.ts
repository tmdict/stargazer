import type { CharacterType } from '@/lib/types/character'

/* Placeholder units: one stand-in per faction, placeable like heroes so a
 * draft can reserve a slot ("some Lightbearer goes here") before committing
 * to one. They live in a reserved band of the character id space, so
 * occupancy, team size, targeting, pathfinding, and serialization treat
 * them as ordinary characters for free; the deliberate differences are small
 * and enforced at call sites via isPlaceholderId / the `placeholder` flag:
 * no uniqueness (copies repeat freely, each standing for a different
 * undecided hero), no paragon, no skill pages, no roster remove-toggle.
 *
 * The real `faction` makes them count toward faction tallies (phantimal
 * qualification); `class` and `damage` are PLACEHOLDER_NONE, which no game
 * rule matches, so class-based checks (Himmel's trio) ignore them without
 * special cases.
 *
 * The band sits far above real hero ids and below the companion band
 * (N * 10000 + mainId, N >= 1), and fits the serializer's 16-bit character
 * field, so share links and saved teams work without codec changes.
 */
export const PLACEHOLDER_ID_OFFSET = 9000

export function isPlaceholderId(id: number): boolean {
  return id >= PLACEHOLDER_ID_OFFSET && id < PLACEHOLDER_ID_OFFSET + 1000
}

// The empty class/damage dimension. Matched by no game rule; filter options
// strip it (CharacterFilterStrip).
export const PLACEHOLDER_NONE = 'none'

// Ids are written down per faction, never derived from a list position:
// FACTION_ORDER is presentational and may be reordered or grow, while these
// ids are baked into share links and saved teams. Append-only.
const FACTION_IDS: Readonly<Record<string, number>> = {
  lightbearer: 9001,
  wilder: 9002,
  mauler: 9003,
  graveborn: 9004,
  celestial: 9005,
  hypogean: 9006,
  dimensional: 9007,
}

// `name` doubles as the icon-dictionary key (faction-lightbearer):
// gameData.getCharacterImage falls back to the icon set for names without a
// portrait, so no image plumbing is needed anywhere.
export const PLACEHOLDERS: readonly CharacterType[] = Object.entries(FACTION_IDS).map(
  ([faction, id]) => ({
    id,
    name: `faction-${faction}`,
    faction,
    class: PLACEHOLDER_NONE,
    damage: PLACEHOLDER_NONE,
    level: 'rare',
    energy: [0],
    range: 1,
    season: 0,
    tags: {},
    placeholder: true,
  }),
)
