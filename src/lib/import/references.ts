/* Runtime reference assembly shared by the worker and offline checker.
 * Curated examples stay separate from the browser's disposable learning. */

import heroIcons from '@/data/import/hero-icons.json'
import { buildHeroTable } from './heroes'
import { readLearnedIcons } from './learned'
import type { HeroTable, LearnedIcon, PortraitRef } from './types'

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
