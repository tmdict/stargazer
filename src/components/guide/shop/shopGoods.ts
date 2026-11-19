/* What the shop calculator draws a product with: its name in the site's
 * languages, the data pack's pictures, the tier that colours its frame, and
 * the steps a move reads as. */

import type { AnswerGoal } from '@/lib/hd/shop/calculate'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import type { Good, Move, ShopCard } from '@/lib/hd/shop/types'
import { TRIAL_CARDS } from '@/lib/hd/units'
import type { DuelEquipment } from '@/lib/types/honorDuel'
import type { AppLocale } from '@/lib/types/i18n'
import type { useI18nStore } from '@/stores/i18n'
import { duelEquipment, duelItemName, matchesDuelItem, matchesName } from '@/utils/duelCatalog'
import { byStem } from '@/utils/fileStem'
import { formatDisplayName } from '@/utils/nameFormatting'
import { goodName } from '@/utils/shopGoodNames'
import { curatedHeroName } from '@/utils/skillLabels'

const images = byStem(
  import.meta.glob<string>('@/pack/images/hd/shop/*.png', {
    query: { format: 'webp', quality: 80, w: 192, h: 192, fit: 'inside' },
    eager: true,
    import: 'default',
  }),
)

export const SHOP_GOODS: ReadonlyMap<string, Good> = new Map(
  SHOP_FACTS.goods.map((good) => [good.name, good]),
)

export const pieceName = (name: string, locale: AppLocale): string => {
  const item = duelEquipment.find((piece) => piece.name === name)
  return item ? duelItemName({ kind: 'equipment', item }, locale) : formatDisplayName(name)
}

/** What a goal reads as: its hero or piece, or the name of a goal that spans targets. */
export const goalName = (goal: AnswerGoal, i18n: ReturnType<typeof useI18nStore>): string => {
  if (goal.kind === 'hero') return curatedHeroName(goal.name, i18n.currentLocale)
  if (goal.kind === 'equipment') return pieceName(goal.name, i18n.currentLocale)
  return i18n.t(`app.shop-goal-${goal.kind}`)
}

/** Whether a search matches a product's name in any of the site's languages. */
export const matchesGood = (good: Good, query: string): boolean =>
  matchesName(query, (locale) => goodName(good.name, locale))

/** Whether a search matches a piece's name in any of the site's languages. */
export const matchesPiece = (item: DuelEquipment, query: string): boolean =>
  matchesDuelItem({ kind: 'equipment', item }, query)

/** What a card reads as: the hero or piece it names, else its product. */
export function cardLabel(card: ShopCard, locale: AppLocale): string {
  const good = SHOP_GOODS.get(card.good ?? '')
  if (!good) return ''
  if (good.kind === 'hero' && card.hero) {
    const hero = curatedHeroName(card.hero, locale)
    return (good.copies ?? 1) > 1 ? `${hero} ×${good.copies}` : hero
  }
  if (good.kind === 'equipment' && card.equipment) return pieceName(card.equipment, locale)
  return goodName(good.name, locale)
}

/** A card's label where one has to show: a card with no product reads as empty. */
export const cardName = (card: ShopCard, i18n: ReturnType<typeof useI18nStore>): string =>
  cardLabel(card, i18n.currentLocale) || i18n.t('app.shop-picker-empty')

const SOLD_AT = new Map<string, number[]>()
MEASURED_ODDS.levels.forEach((sources, index) => {
  for (const good of new Set(sources.flat().map((entry) => entry.good))) {
    SOLD_AT.set(good, [...(SOLD_AT.get(good) ?? []), index + 1])
  }
})

/**
 * The shop levels a locked card may have been locked at, lowest first: those up
 * to the shop's that sell its product. The last is the one the calculator reads
 * the card at when the card names none.
 */
export const lockLevels = (card: ShopCard, level: number): number[] =>
  card.locked && card.good ? (SOLD_AT.get(card.good) ?? []).filter((one) => one <= level) : []

/** The shop level a locked card is read at. */
export const lockedLevel = (card: ShopCard, level: number): number =>
  card.lockedAt ?? lockLevels(card, level).at(-1) ?? level

export type ShopPickerStep = 'product' | 'hero' | 'piece'

type ShopPicture = 'badge' | 'artifact-exp' | 'random-card'

/** A shop picture, or undefined where the data pack holds none. */
export const shopPicture = (name: ShopPicture): string | undefined => images[name]

type ShopTier = 'rare' | 'elite' | 'epic' | 'legendary' | 'mythic' | 'supreme'

// A trial card takes the tier of the unit it lends.
export const goodTier = (good: Good): ShopTier | undefined =>
  good.tier ?? TRIAL_CARDS.find((card) => card.card === good.name)?.tier

export interface ShopStep {
  kind: 'buy' | 'lock' | 'unlock' | 'keep' | 'reroll' | 'wait'
  card?: number
  price?: number
}

const lockSteps = (locks: readonly number[], cards: readonly ShopCard[]): ShopStep[] => {
  const held = cards.flatMap((card, index) => (card.locked && !card.bought ? [index] : []))
  return [
    ...held
      .filter((card) => !locks.includes(card))
      .map((card): ShopStep => ({ kind: 'unlock', card })),
    ...held
      .filter((card) => locks.includes(card))
      .map((card): ShopStep => ({ kind: 'keep', card })),
    ...locks
      .filter((card) => !held.includes(card))
      .map((card): ShopStep => ({ kind: 'lock', card })),
  ]
}

const buyStep = (card: number, cards: readonly ShopCard[]): ShopStep => ({
  kind: 'buy',
  card,
  price: SHOP_GOODS.get(cards[card]?.good ?? '')?.price,
})

/** A move as the steps a player takes, against the locks as entered. */
export const moveSteps = (move: Move, cards: readonly ShopCard[]): ShopStep[] =>
  move.kind === 'buy'
    ? [buyStep(move.card, cards)]
    : [...lockSteps(move.locks, cards), { kind: 'reroll', price: SHOP_FACTS.reroll }]

/** Stopping for the round: what to buy and lock before waiting. */
export const stopSteps = (
  plan: { locks: readonly number[]; buy: number | null },
  cards: readonly ShopCard[],
): ShopStep[] => [
  ...(plan.buy === null ? [] : [buyStep(plan.buy, cards)]),
  ...lockSteps(plan.locks, cards).filter((step) => step.card !== plan.buy),
  { kind: 'wait' },
]
