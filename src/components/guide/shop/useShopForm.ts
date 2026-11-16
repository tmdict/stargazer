/* What the player has entered on the shop calculator: the round, the badges,
 * the eight cards, the heroes and equipment looked for, and the heroes to sell
 * or leave out. Nothing is kept between visits. `changed` runs on every edit,
 * which is how the page drops answers that no longer belong to what is shown. */

import { computed, ref, watch } from 'vue'

import { duelEquipment } from '@/lib/hd/catalog'
import { SHOP_LIMITS, type ShopRequest, type WantedHero } from '@/lib/hd/shop/calculate'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { levelOfRound, SOURCES } from '@/lib/hd/shop/odds'
import { shopPools } from '@/lib/hd/shop/pools'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useGameDataStore } from '@/stores/gameData'

/** The last round a duel can reach. */
export const LAST_ROUND = 11

const blank = (): ShopCard => ({ good: null, locked: false, bought: false })

export function useShopForm(changed: () => void) {
  const gameData = useGameDataStore()

  const round = ref(1)
  const badges = ref(SHOP_FACTS.startingBadges)
  const cards = ref<ShopCard[]>(Array.from({ length: SOURCES }, blank))
  const heroes = ref<WantedHero[]>([])
  const equipment = ref<string[]>([])
  const sell = ref<string[]>([])
  const mythic = ref<string[]>([])

  watch([round, badges, cards, heroes, equipment, sell, mythic], changed, { deep: true })

  const level = computed(() => levelOfRound(round.value, SHOP_FACTS.levelRounds))
  const rises = computed(() => levelOfRound(round.value + 1, SHOP_FACTS.levelRounds) > level.value)

  const setBadges = (value: number): void => {
    if (!Number.isFinite(value)) return
    badges.value = Math.min(SHOP_LIMITS.badges, Math.max(0, Math.round(value)))
  }

  const setCard = (index: number, card: ShopCard): void => {
    cards.value[index] = card
  }

  const toggleLock = (index: number): void => {
    const card = cards.value[index]
    if (card && !card.bought) card.locked = !card.locked
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
      round: round.value,
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
    round,
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
