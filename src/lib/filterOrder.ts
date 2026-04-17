/**
 * Canonical display orders for faction and class, used by:
 * - `FilterIcons.vue` for the icon row
 * - `compareFaction` for character grid sorting
 *
 * Anything not in the order list falls through to alphabetical at the end.
 */

export const FACTION_ORDER: readonly string[] = [
  'lightbearer',
  'wilder',
  'mauler',
  'graveborn',
  'celestial',
  'hypogean',
  'dimensional',
]

export const CLASS_ORDER: readonly string[] = [
  'tank',
  'support',
  'marksman',
  'mage',
  'rogue',
  'warrior',
]

export function compareByOrder(a: string, b: string, order: readonly string[]): number {
  const ai = order.indexOf(a)
  const bi = order.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

export function compareFaction(a: string, b: string): number {
  return compareByOrder(a, b, FACTION_ORDER)
}
