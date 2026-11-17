/* What the shop calculator draws a product with: its name in the site's
 * languages, the data pack's pictures, the tier that colours its frame, and
 * the steps a move reads as. */

import { duelEquipment, duelItemName } from '@/lib/hd/catalog'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { MEASURED_ODDS } from '@/lib/hd/shop/measured'
import type { Good, Move, ShopCard } from '@/lib/hd/shop/types'
import type { DuelEquipment } from '@/lib/types/honorDuel'
import { APP_LOCALES, type AppLocale, type LocaleData } from '@/lib/types/i18n'
import { fileStem } from '@/utils/fileStem'
import { formatDisplayName } from '@/utils/nameFormatting'
import { curatedHeroName } from '@/utils/skillLabels'

const byStem = <T>(modules: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(modules).map(([path, value]) => [fileStem(path), value]))

const names = byStem(
  import.meta.glob<LocaleData>('@/locales/hd/shop/*.json', { eager: true, import: 'default' }),
)

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

export const goodName = (name: string, locale: AppLocale): string =>
  names[name]?.[locale] || formatDisplayName(name)

export const pieceName = (name: string, locale: AppLocale): string => {
  const item = duelEquipment.find((piece) => piece.name === name)
  return item ? duelItemName({ kind: 'equipment', item }, locale) : formatDisplayName(name)
}

const within = (query: string, name: (locale: AppLocale) => string): boolean => {
  const text = query.trim().toLowerCase()
  return !text || APP_LOCALES.some((locale) => name(locale).toLowerCase().includes(text))
}

/** Whether a search matches a product's name in any of the site's languages. */
export const matchesGood = (good: Good, query: string): boolean =>
  within(query, (locale) => goodName(good.name, locale))

/** Whether a search matches a piece's name in any of the site's languages. */
export const matchesPiece = (item: DuelEquipment, query: string): boolean =>
  within(query, (locale) => duelItemName({ kind: 'equipment', item }, locale))

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

export type ShopPickerStep = 'product' | 'hero' | 'piece'

type ShopPicture = 'badge' | 'artifact-exp' | 'random-card'

/** A shop picture, or undefined where the data pack holds none. */
export const shopPicture = (name: ShopPicture): string | undefined => images[name]

type ShopTier = 'rare' | 'elite' | 'epic' | 'legendary' | 'mythic' | 'supreme'

// A trial card's price follows the tier of the hero it lends.
const TRIAL_TIERS: Record<string, ShopTier> = {
  'trial-card-6': 'epic',
  'trial-card-12': 'legendary',
  'trial-card-22': 'mythic',
  'trial-card-45': 'supreme',
}

export const goodTier = (good: Good): ShopTier | undefined => good.tier ?? TRIAL_TIERS[good.name]

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
