/* The numbers the shop probability guide shows, worked out from the shop's
 * rules and the measured odds table so the page follows the data. */

import { computed, reactive } from 'vue'

import { duelHeroes } from '@/lib/hd/heroes'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import { packChance, showChance } from '@/lib/hd/shop/probability'
import type { Good, LevelOdds } from '@/lib/hd/shop/types'
import { useGameDataStore } from '@/stores/gameData'

const good = (pick: (entry: Good) => boolean): Good | undefined => SHOP_FACTS.goods.find(pick)

const HERO_CARD = good((entry) => entry.kind === 'hero' && (entry.copies ?? 1) === 1)
const PAIR_CARD = good((entry) => entry.kind === 'hero' && (entry.copies ?? 1) > 1)
const LEGENDARY = good((entry) => entry.kind === 'legendary')
const RANDOM_PACK = good((entry) => entry.kind === 'pack' && !entry.faction)
const FACTION_PACK = good((entry) => entry.kind === 'pack' && !!entry.faction)

const REROLL = SHOP_FACTS.reroll
const HERO_PRICE = HERO_CARD?.price ?? 0
const PAIR_PRICE = PAIR_CARD?.price ?? 0
const RANDOM_PRICE = RANDOM_PACK?.price ?? 0
const FACTION_PRICE = FACTION_PACK?.price ?? 0
const DRAWS = RANDOM_PACK?.draws ?? 0

const makes = (sources: LevelOdds, name: string | undefined): boolean =>
  sources.flat().some((made) => made.good === name)

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

const PAIR_LEVELS = LEVELS.filter(({ sources }) => makes(sources, PAIR_CARD?.name))

const ROUNDS = SHOP_FACTS.rounds.map((entry, index) => {
  const round = index + 1
  return {
    round: index === SHOP_FACTS.rounds.length - 1 ? `${round}+` : `${round}`,
    badges: entry.badges.map((count) => (index ? `+${count}` : `${count}`)).join(' / '),
    level: SHOP_FACTS.levelRounds.filter((first) => first <= round).length,
    event: entry.event,
  }
})

const SOLD = SHOP_FACTS.goods.filter((entry) =>
  MEASURED_ODDS.levels.some((sources) => makes(sources, entry.name)),
)

// How often a shop shows a card of one hero out of `size`, counting the cards `counts` takes.
const heroShows = (
  sources: LevelOdds,
  size: number,
  counts: (entry: Good | undefined) => boolean,
): number =>
  size
    ? showChance(sources, (name) =>
        counts(SHOP_FACTS.goods.find((entry) => entry.name === name)) ? 1 / size : 0,
      )
    : 0

const isHeroCard = (entry: Good | undefined): boolean => entry?.kind === 'hero'
const isSingle = (entry: Good | undefined): boolean => entry === HERO_CARD
const isPair = (entry: Good | undefined): boolean => entry === PAIR_CARD

const range = (values: number[]): { low: number; high: number } =>
  values.length ? { low: Math.min(...values), high: Math.max(...values) } : { low: 0, high: 0 }

/** A chance as a percent to one decimal, or a dash for none. */
export const percent = (chance: number): string =>
  chance > 0 ? `${(chance * 100).toFixed(1)}%` : '–'

export function useShopFigures() {
  const gameData = useGameDataStore()
  const pool = computed(() => duelHeroes(gameData.characters))
  const factionPool = computed(
    () => pool.value.filter((hero) => hero.faction === FACTION_PACK?.faction).length,
  )

  const packs = computed(() =>
    [1, 2, 3].map((wanted) => ({
      wanted,
      random: packChance(wanted, pool.value.length, DRAWS),
      faction: packChance(wanted, factionPool.value, DRAWS),
    })),
  )

  const hero = computed(() =>
    LEVELS.map(({ level, sources }) => {
      const size = pool.value.length
      const chance = heroShows(sources, size, isHeroCard)
      return {
        level,
        single: heroShows(sources, size, isSingle),
        pair: heroShows(sources, size, isPair),
        chance,
        rerolls: chance > 0 ? 1 / chance : null,
      }
    }),
  )

  const products = SOLD.map((entry) => ({
    name: entry.name,
    price: entry.price,
    chances: LEVELS.map(({ sources }) =>
      showChance(sources, (name) => (name === entry.name ? 1 : 0)),
    ),
  }))

  // The level a hero card shows most often at, for the worked example.
  const example = computed(() => {
    const best = hero.value.reduce((a, b) => (b.chance > a.chance ? b : a))
    const rerolls = best.rerolls ?? 0
    // A shop that shows the hero on two-copy cards alone leaves no cheaper card to buy.
    const pairOnly = best.chance > 0 ? (best.chance - best.single) / best.chance : 0
    const price = HERO_PRICE + (PAIR_PRICE - HERO_PRICE) * pairOnly
    return {
      level: best.level,
      chance: best.chance,
      rerolls,
      rerollBadges: rerolls * REROLL,
      pairOnly,
      price,
      badges: rerolls * REROLL + price,
      // The chance the card has still not shown after the average number of rerolls.
      unlucky: best.chance > 0 ? (1 - best.chance) ** Math.round(rerolls) : 0,
      rounded: Math.round(rerolls),
    }
  })

  const packCost = computed(() => {
    const [one] = packs.value
    return {
      random: one && one.random > 0 ? RANDOM_PRICE / one.random : 0,
      faction: one && one.faction > 0 ? FACTION_PRICE / one.faction : 0,
    }
  })

  // The badges a pack costs for each copy of one wanted hero it gives on average.
  const copyCost = computed(() => ({
    random: DRAWS ? (RANDOM_PRICE * pool.value.length) / DRAWS : 0,
    faction: DRAWS ? (FACTION_PRICE * factionPool.value) / DRAWS : 0,
  }))

  // The pool size under which a Random Pack finds one hero for fewer badges than a faction pack.
  const packPool = computed(() => {
    const faction = packCost.value.faction
    return DRAWS && faction > RANDOM_PRICE
      ? 1 / (1 - (1 - RANDOM_PRICE / faction) ** (1 / DRAWS))
      : 0
  })

  // The chance a reroll shows the one-copy card, above which waiting for it beats the two-copy card.
  const pairBreakEven = PAIR_PRICE > HERO_PRICE ? REROLL / (PAIR_PRICE - HERO_PRICE) : 0

  const pairSingle = computed(() =>
    range(hero.value.filter((row) => row.pair > 0).map((row) => row.single)),
  )

  // The largest pools, by level, in which the one-copy card shows often enough to wait for.
  const pairPool = computed(() =>
    range(
      PAIR_LEVELS.map(({ sources }) => {
        let size = pool.value.length
        while (size > 1 && heroShows(sources, size, isSingle) <= pairBreakEven) size--
        return size
      }),
    ),
  )

  return reactive({
    reroll: REROLL,
    sell: SHOP_FACTS.sell,
    draws: DRAWS,
    heroPrice: HERO_PRICE,
    pairPrice: PAIR_PRICE,
    randomPrice: RANDOM_PRICE,
    factionPrice: FACTION_PRICE,
    legendaryPrice: LEGENDARY?.price ?? 0,
    legendaryCopies: LEGENDARY?.copies ?? 0,
    packRefund: DRAWS * SHOP_FACTS.sell,
    randomPack: RANDOM_PACK?.name ?? '',
    heroCard: HERO_CARD?.name ?? '',
    pairCard: PAIR_CARD?.name ?? '',
    pairFrom: PAIR_LEVELS[0]?.level ?? 0,
    pairBreakEven,
    // What a pack's price is of the price of the copies it picks, the share of wanted heroes a pool
    // needs before the pack matches one-copy cards.
    packShare: {
      random: DRAWS && HERO_PRICE ? RANDOM_PRICE / (DRAWS * HERO_PRICE) : 0,
      faction: DRAWS && HERO_PRICE ? FACTION_PRICE / (DRAWS * HERO_PRICE) : 0,
    },
    levels: LEVELS,
    rounds: ROUNDS,
    records: (MEASURED_ODDS.rerolls ?? []).reduce((sum, count) => sum + count, 0),
    poolSize: computed(() => pool.value.length),
    factionPoolSize: factionPool,
    packs,
    hero,
    products,
    example,
    packCost,
    copyCost,
    packPool,
    pairSingle,
    pairPool,
  })
}
