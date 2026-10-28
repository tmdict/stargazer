/* Runtime reference assembly shared by the worker and offline checker.
 * Curated examples stay separate from the browser's disposable learning. */

import heroIcons from '@/pack/screenshot-import/hero-icons.json'
import { buildHeroTable } from './card/heroes'
import type { HeroTable, LearnedIcon, PortraitRef } from './card/types'
import { BOARD_BACKDROP } from './core/image'
import { readLearnedIcons } from './learned'

const curated = readLearnedIcons(heroIcons)

export function buildImportHeroTable(
  portraits: readonly PortraitRef[],
  learned: readonly LearnedIcon[] = [],
): HeroTable {
  const knownHeroes = new Set(portraits.map((portrait) => portrait.characterId))
  const icons = new Map<string, LearnedIcon>()
  // A user's lesson for the same face takes precedence without editing the shared baseline.
  for (const icon of [...curated, ...learned]) {
    if (knownHeroes.has(icon.characterId)) icons.set(icon.descriptor, icon)
  }
  return buildHeroTable(portraits, [...icons.values()])
}

/* The heroes as a formation board draws them, over its backdrop: a hero a
 * skill draws with a picture of its own (Elijah alone) ranks under that
 * picture and its outfits rather than its portrait's. Faces learned from
 * cards stay out, since a board never frames a face as a card does. */
export function buildBoardTable(
  portraits: readonly PortraitRef[],
  pictures: readonly PortraitRef[],
): HeroTable {
  const replaced = new Set(pictures.map((picture) => picture.characterId))
  return buildHeroTable(
    [...portraits.filter((portrait) => !replaced.has(portrait.characterId)), ...pictures],
    [],
    BOARD_BACKDROP,
  )
}

// Phantimals and companions, which only a board's portraits rank against.
export const buildUnitTable = (units: readonly PortraitRef[]): HeroTable =>
  buildHeroTable(units, [], BOARD_BACKDROP)
