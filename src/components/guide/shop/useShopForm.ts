/* What the player has entered on the shop calculator: the round, the badges,
 * the eight cards, the heroes and equipment looked for, and the heroes to sell
 * or leave out. Nothing is kept between visits. `changed` runs on every edit,
 * which is how the page drops answers that no longer belong to what is shown. */

import { computed, ref, watch } from 'vue'

import { duelEquipment } from '@/lib/hd/catalog'
import { SHOP_LIMITS, type ShopRequest, type WantedHero } from '@/lib/hd/shop/calculate'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import { risesNext, SOURCES } from '@/lib/hd/shop/odds'
import { shopPools } from '@/lib/hd/shop/pools'
import { sampleShop } from '@/lib/hd/shop/sample'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useGameDataStore } from '@/stores/gameData'
import { lockLevels } from './shopGoods'

const blank = (): ShopCard => ({ good: null, locked: false, bought: false })

export function useShopForm(changed: () => void) {
  const gameData = useGameDataStore()

  const level = ref(1)
  const risesSaid = ref(false)
  const badges = ref(SHOP_FACTS.startingBadges)
  const cards = ref<ShopCard[]>(Array.from({ length: SOURCES }, blank))
  const heroes = ref<WantedHero[]>([])
  const equipment = ref<string[]>([])
  const sell = ref<string[]>([])
  const mythic = ref<string[]>([])

  const rises = computed({
    get: () => risesNext(level.value, risesSaid.value, SHOP_FACTS.levelRounds),
    set: (said) => (risesSaid.value = said),
  })
  // What was said of one level says nothing of another.
  watch(level, () => {
    risesSaid.value = false
    for (const card of cards.value) {
      if (card.lockedAt !== undefined && card.lockedAt >= level.value) delete card.lockedAt
    }
  })

  watch([level, rises, badges, cards, heroes, equipment, sell, mythic], changed, { deep: true })

  const setBadges = (value: number): void => {
    if (!Number.isFinite(value)) return
    badges.value = Math.min(SHOP_LIMITS.badges, Math.max(0, Math.round(value)))
  }

  // The level a card was locked at lasts as long as its lock and its product.
  const setCard = (index: number, card: ShopCard): void => {
    const was = cards.value[index]
    const next = { ...card }
    delete next.lockedAt
    if (card.locked && card.good === was?.good && was?.lockedAt !== undefined) {
      next.lockedAt = was.lockedAt
    }
    cards.value[index] = next
  }

  const setLock = (card: ShopCard, locked: boolean): void => {
    card.locked = locked
    if (!locked) delete card.lockedAt
  }

  const toggleLock = (index: number): void => {
    const card = cards.value[index]
    if (card && !card.bought) setLock(card, !card.locked)
  }

  const setLocks = (locks: readonly number[]): void => {
    cards.value.forEach((card, index) => {
      if (!card.bought) setLock(card, locks.includes(index))
    })
  }

  const setLockedAt = (index: number, at: number): void => {
    const card = cards.value[index]
    if (!card) return
    if (at === lockLevels(card, level.value).at(-1)) delete card.lockedAt
    else card.lockedAt = at
  }

  const clearCards = (): void => {
    cards.value = Array.from({ length: SOURCES }, blank)
  }

  // An example of what the level can show, drawn from the table the odds view
  // shows. A data pack's table lists the same products for every source, so the
  // calculator can read the example whichever table it uses.
  const fillExample = (): void => {
    const out = new Set(mythic.value)
    cards.value = sampleShop(MEASURED_ODDS.levels[level.value - 1]!, SHOP_FACTS, {
      heroes: SHOP_FACTS.heroes.filter((name) => !out.has(name)),
      equipment: duelEquipment.filter((piece) => piece.shop),
    })
  }

  const without = (list: string[], name: string): string[] => list.filter((one) => one !== name)

  const addHero = (name: string): void => {
    if (heroes.value.some((hero) => hero.name === name)) return
    heroes.value.push({ name, copies: 1 })
    sell.value = without(sell.value, name)
  }

  const setCopies = (name: string, copies: number): void => {
    const hero = heroes.value.find((one) => one.name === name)
    if (hero && copies >= 1 && copies <= SHOP_LIMITS.copies) hero.copies = copies
  }

  const removeHero = (name: string): void => {
    heroes.value = heroes.value.filter((hero) => hero.name !== name)
  }

  const addEquipment = (name: string): void => {
    if (!equipment.value.includes(name)) equipment.value.push(name)
  }

  const removeEquipment = (name: string): void => {
    equipment.value = without(equipment.value, name)
  }

  // A hero is looked for, sold or left out, never two of them.
  const toggleSell = (name: string): void => {
    if (sell.value.includes(name)) {
      sell.value = without(sell.value, name)
      return
    }
    sell.value.push(name)
    mythic.value = without(mythic.value, name)
    removeHero(name)
  }

  const toggleMythic = (name: string): void => {
    if (mythic.value.includes(name)) {
      mythic.value = without(mythic.value, name)
      return
    }
    mythic.value.push(name)
    sell.value = without(sell.value, name)
    removeHero(name)
  }

  const wanted = computed(() => heroes.value.length > 0 || equipment.value.length > 0)

  // Plain copies throughout: a worker cannot be sent Vue's reactive objects.
  const request = (): ShopRequest => {
    const factions = new Map(gameData.characters.map((c) => [c.name, c.faction]))
    const tiers = new Map(duelEquipment.map((piece) => [piece.name, piece.tier]))
    return {
      level: level.value,
      rises: rises.value,
      shop: { badges: badges.value, cards: cards.value.map((card) => ({ ...card })) },
      heroes: heroes.value.map((hero) => ({ ...hero })),
      equipment: equipment.value.flatMap((name) => {
        const tier = tiers.get(name)
        return tier ? [{ name, tier }] : []
      }),
      pools: shopPools(
        SHOP_FACTS,
        (hero) => factions.get(hero) ?? '',
        duelEquipment,
        [...mythic.value],
        [...sell.value],
      ),
    }
  }

  return {
    badges,
    cards,
    heroes,
    equipment,
    sell,
    mythic,
    level,
    rises,
    wanted,
    setBadges,
    setCard,
    toggleLock,
    setLocks,
    setLockedAt,
    clearCards,
    fillExample,
    addHero,
    setCopies,
    removeHero,
    addEquipment,
    removeEquipment,
    toggleSell,
    toggleMythic,
    request,
  }
}
