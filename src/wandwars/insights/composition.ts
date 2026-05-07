import type { CharacterType } from '@/lib/types/character'
import type { MatchResult } from '@/wandwars/types'

// Win/loss tallies for each composition pattern label, organized by category.
// Categories are intentionally string-keyed because the labels are dynamic
// (e.g. "all melee", "3x mage", "high energy (500+)").
export interface CompositionStats {
  damage: Record<string, { w: number; l: number }>
  range: Record<string, { w: number; l: number }>
  class: Record<string, { w: number; l: number }>
  energy: Record<string, { w: number; l: number }>
}

// Iterates each decisive match's two teams and aggregates composition patterns
// (damage type, range, class concentration, energy) with their win/loss counts.
// Pure — no Vue, no i18n.
export function computeCompositionStats(
  matchData: MatchResult[],
  heroAttrMap: Record<string, CharacterType>,
): CompositionStats {
  const stats: CompositionStats = { damage: {}, range: {}, class: {}, energy: {} }

  const decisive = matchData.filter((m) => m.result !== 'draw')
  for (const match of decisive) {
    for (const [team, isWinner] of [
      [match.left, match.result === 'left'],
      [match.right, match.result === 'right'],
    ] as [readonly [string, string, string], boolean][]) {
      const attrs = team.map((h) => heroAttrMap[h]).filter((a): a is CharacterType => !!a)
      if (attrs.length !== 3) continue

      // Damage type balance
      const dmgTypes = new Set(attrs.map((a) => a.damage))
      const dmgKey = dmgTypes.size === 1 ? `all ${attrs[0]!.damage}` : 'mixed damage'
      if (!stats.damage[dmgKey]) stats.damage[dmgKey] = { w: 0, l: 0 }
      stats.damage[dmgKey]![isWinner ? 'w' : 'l']++

      // Range balance
      const allMelee = attrs.every((a) => a.range <= 1)
      const allRanged = attrs.every((a) => a.range > 1)
      const rangeKey = allMelee ? 'all melee' : allRanged ? 'all ranged' : 'mixed range'
      if (!stats.range[rangeKey]) stats.range[rangeKey] = { w: 0, l: 0 }
      stats.range[rangeKey]![isWinner ? 'w' : 'l']++

      // Class composition (most common class)
      const classCounts: Record<string, number> = {}
      for (const a of attrs) classCounts[a.class] = (classCounts[a.class] || 0) + 1
      const maxClass = Object.entries(classCounts).sort(([, a], [, b]) => b - a)[0]!
      if (maxClass[1] >= 2) {
        const classKey = maxClass[1] === 3 ? `3x ${maxClass[0]}` : `2+ ${maxClass[0]}`
        if (!stats.class[classKey]) stats.class[classKey] = { w: 0, l: 0 }
        stats.class[classKey]![isWinner ? 'w' : 'l']++
      }

      // Team energy: sum each hero's base + skill-granted starting energy, average over 3.
      const avgEnergy = attrs.reduce((s, a) => s + a.energy.reduce((n, e) => n + e, 0), 0) / 3
      const energyKey =
        avgEnergy >= 500 ? 'high energy (500+)' : avgEnergy < 200 ? 'low energy (<200)' : null
      if (energyKey) {
        if (!stats.energy[energyKey]) stats.energy[energyKey] = { w: 0, l: 0 }
        stats.energy[energyKey]![isWinner ? 'w' : 'l']++
      }
    }
  }

  return stats
}
