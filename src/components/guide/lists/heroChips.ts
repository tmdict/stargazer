/* The chips that pick heroes on the lists page, by range, damage, class and
 * faction: any chip of a group matches, and every group with a chip on must
 * match. A chip's id is its group and value, `class:tank`. */

import { CLASS_ORDER, FACTION_ORDER } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'

export type ChipGroup = 'range' | 'damage' | 'class' | 'faction'

export const HERO_CHIPS: Record<ChipGroup, readonly string[]> = {
  range: ['melee', 'ranged'],
  damage: ['physical', 'magic'],
  class: CLASS_ORDER,
  faction: FACTION_ORDER,
}

const valueOf = (hero: CharacterType, group: ChipGroup): string =>
  group === 'range' ? (hero.range === 1 ? 'melee' : 'ranged') : hero[group]

export function matchesChips(hero: CharacterType, chosen: ReadonlySet<string>): boolean {
  return (Object.keys(HERO_CHIPS) as ChipGroup[]).every((group) => {
    const picked = HERO_CHIPS[group].filter((value) => chosen.has(`${group}:${value}`))
    return !picked.length || picked.includes(valueOf(hero, group))
  })
}
