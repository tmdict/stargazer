/* The numbers the shop probability guide shows, worked out from the shop's
 * rules and the measured odds table so the page follows the data. */

import { computed } from 'vue'

import { duelHeroes } from '@/lib/hd/heroes'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import { packChance, showChance } from '@/lib/hd/shop/probability'
import { useGameDataStore } from '@/stores/gameData'

const good = (pick: (kind: string, faction?: string) => boolean) =>
  SHOP_FACTS.goods.find((entry) => pick(entry.kind, entry.faction))

const RANDOM_PACK = good((kind, faction) => kind === 'pack' && !faction)
const FACTION_PACK = good((kind, faction) => kind === 'pack' && !!faction)
const HERO_CARD = good((kind) => kind === 'hero')
const HERO_KINDS = new Set(SHOP_FACTS.goods.filter((g) => g.kind === 'hero').map((g) => g.name))

const LEVELS = MEASURED_ODDS.levels.map((sources, index) => {
  const from = SHOP_FACTS.levelRounds[index] ?? 1
  const next = SHOP_FACTS.levelRounds[index + 1]
  return {
    level: index + 1,
    sources,
    rounds: next === undefined ? `${from}+` : next - 1 > from ? `${from}–${next - 1}` : `${from}`,
    records: MEASURED_ODDS.rerolls?.[index],
  }
})

const SOLD = SHOP_FACTS.goods.filter((entry) =>
  MEASURED_ODDS.levels.some((sources) => sources.flat().some((made) => made.good === entry.name)),
)

/** A chance as a percent to one decimal, or a dash for none. */
export const percent = (chance: number): string =>
  chance > 0 ? `${(chance * 100).toFixed(1)}%` : '–'

export function useShopFigures() {
  const gameData = useGameDataStore()
  const pool = computed(() => duelHeroes(gameData.characters))
  const factionPool = computed(
    () => pool.value.filter((hero) => hero.faction === FACTION_PACK?.faction).length,
  )
  const draws = RANDOM_PACK?.draws ?? 0

  const packs = computed(() =>
    [1, 2, 3].map((wanted) => ({
      wanted,
      random: packChance(wanted, pool.value.length, draws),
      faction: packChance(wanted, factionPool.value, FACTION_PACK?.draws ?? 0),
    })),
  )

  const hero = computed(() =>
    LEVELS.map(({ level, sources }) => {
      const size = pool.value.length
      const chance = size ? showChance(sources, (name) => (HERO_KINDS.has(name) ? 1 / size : 0)) : 0
      return { level, chance, rerolls: chance > 0 ? 1 / chance : null }
    }),
  )

  const products = SOLD.map((entry) => ({
    name: entry.name,
    chances: LEVELS.map(({ sources }) =>
      showChance(sources, (name) => (name === entry.name ? 1 : 0)),
    ),
  }))

  // The level a hero card shows most often at, for the worked example.
  const example = computed(() => {
    const best = hero.value.reduce((a, b) => (b.chance > a.chance ? b : a))
    const rerolls = best.rerolls ?? 0
    return {
      level: best.level,
      chance: best.chance,
      rerolls,
      rerollBadges: rerolls * SHOP_FACTS.reroll,
      badges: rerolls * SHOP_FACTS.reroll + (HERO_CARD?.price ?? 0),
      // The chance the card has still not shown after the average number of rerolls.
      unlucky: best.chance > 0 ? (1 - best.chance) ** Math.round(rerolls) : 0,
      rounded: Math.round(rerolls),
    }
  })

  const packCost = computed(() => {
    const [one] = packs.value
    return {
      random: one && one.random > 0 ? (RANDOM_PACK?.price ?? 0) / one.random : 0,
      faction: one && one.faction > 0 ? (FACTION_PACK?.price ?? 0) / one.faction : 0,
    }
  })

  return {
    reroll: SHOP_FACTS.reroll,
    sell: SHOP_FACTS.sell,
    draws,
    heroPrice: HERO_CARD?.price ?? 0,
    randomPrice: RANDOM_PACK?.price ?? 0,
    factionPrice: FACTION_PACK?.price ?? 0,
    randomPack: RANDOM_PACK?.name ?? '',
    levels: LEVELS,
    records: (MEASURED_ODDS.rerolls ?? []).reduce((sum, count) => sum + count, 0),
    poolSize: computed(() => pool.value.length),
    factionPoolSize: factionPool,
    packs,
    hero,
    products,
    example,
    packCost,
  }
}
