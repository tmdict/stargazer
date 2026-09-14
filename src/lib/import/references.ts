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
  const seen = new Set<string>()
  const icons = [...curated, ...learned].filter((icon) => {
    if (!knownHeroes.has(icon.characterId)) return false
    const key = `${icon.characterId}:${icon.descriptor}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return buildHeroTable(portraits, icons)
}
