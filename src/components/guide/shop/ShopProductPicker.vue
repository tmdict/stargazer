<script setup lang="ts">
/* The popup that sets what a shop card shows: one of the shop's products or
   nothing, then, for a hero card or an equipment card, which hero or piece it
   is. The products are rows under a heading for each kind, and a row drops the
   words its heading already says. Naming the hero or piece is optional, since
   a card that is not one looked for needs no name. A product is set as soon as
   it is picked, so the popup can be left at any step, and a card keeps its
   name while the product picked takes the same one. A search over the
   products lists every product, hero card and piece whose name it matches, and
   picking a hero or a piece there sets the card in one step. */

import { computed, ref } from 'vue'

import ShopBadges from './ShopBadges.vue'
import ShopEquipmentList from './ShopEquipmentList.vue'
import ShopGoodArt from './ShopGoodArt.vue'
import ShopPopupClose from './ShopPopupClose.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import PaletteSearch from '@/components/ui/PaletteSearch.vue'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import type { Good, GoodKind, ShopCard } from '@/lib/hd/shop/types'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import { duelEquipment } from '@/utils/duelCatalog'
import { goodName } from '@/utils/shopGoodNames'
import { gameLabel } from '@/utils/skillLabels'
import {
  cardLabel,
  goodTier,
  matchesGood,
  matchesPiece,
  pieceName,
  SHOP_GOODS,
  type ShopPickerStep,
} from './shopGoods'

const { card, heroes } = defineProps<{
  card: ShopCard
  // The heroes a hero card can show.
  heroes: readonly CharacterType[]
}>()

const emit = defineEmits<{ set: [card: ShopCard]; close: [] }>()

const i18n = useI18nStore()

// Which of the popup's steps is shown: the products, or naming the hero or piece.
const step = defineModel<ShopPickerStep>('step', { required: true })
const good = computed(() => SHOP_GOODS.get(card.good ?? ''))

const GROUPS: readonly (readonly GoodKind[])[] = [
  ['hero', 'legendary'],
  ['pack'],
  ['equipment'],
  ['trial'],
  ['exp'],
]

const heading = (kind: GoodKind, goods: readonly Good[]): string => {
  if (kind === 'hero') return i18n.t('app.heroes')
  if (kind === 'pack') return i18n.t('app.shop-group-packs', { draws: goods[0]?.draws ?? 0 })
  if (kind === 'equipment') return gameLabel('equipment', i18n.currentLocale)
  return i18n.t(kind === 'trial' ? 'app.shop-group-trial' : 'app.shop-group-other')
}

const rowName = (one: Good): string => {
  const locale = i18n.currentLocale
  if (one.kind === 'pack') {
    return one.faction ? gameLabel(one.faction, locale) : i18n.t('app.shop-pack-random')
  }
  const tier = goodTier(one)
  if (tier) return gameLabel(tier, locale)
  return goodName(one.name, locale)
}

const groups = computed(() =>
  GROUPS.map((kinds) => {
    const goods = SHOP_FACTS.goods.filter((one) => kinds.includes(one.kind))
    return { key: kinds[0]!, heading: heading(kinds[0]!, goods), goods }
  }).filter((group) => group.goods.length),
)

const query = ref('')
const searching = computed(() => query.value.trim() !== '')

interface Found {
  key: string
  good: Good
  label: string
  hero?: string
  equipment?: string
}

const found = computed((): Found[] => {
  if (!searching.value) return []
  const locale = i18n.currentLocale
  const goods = SHOP_FACTS.goods
  const named = matchCharacterNames(query.value.trim())
  const heroGoods = goods.filter((one) => one.kind === 'hero')
  return [
    ...goods
      .filter((one) => matchesGood(one, query.value))
      .map((one) => ({ key: one.name, good: one, label: goodName(one.name, locale) })),
    ...heroes
      .filter((hero) => named.has(hero.name))
      .flatMap((hero) =>
        heroGoods.map((one) => ({
          key: `${one.name}:${hero.name}`,
          good: one,
          hero: hero.name,
          label: cardLabel(
            { good: one.name, hero: hero.name, locked: false, bought: false },
            locale,
          ),
        })),
      ),
    ...duelEquipment
      .filter((piece) => piece.shop && matchesPiece(piece, query.value))
      .flatMap((piece) => {
        const one = goods.find((good) => good.kind === 'equipment' && good.tier === piece.tier)
        return one
          ? [
              {
                key: `${one.name}:${piece.name}`,
                good: one,
                equipment: piece.name,
                label: pieceName(piece.name, locale),
              },
            ]
          : []
      }),
  ]
})

const choose = (picked: Good): void => {
  if (picked.name !== card.good) {
    const named = good.value?.kind === picked.kind && good.value.tier === picked.tier
    emit('set', {
      good: picked.name,
      locked: card.locked,
      bought: false,
      ...(named && card.hero && { hero: card.hero }),
      ...(named && card.equipment && { equipment: card.equipment }),
    })
  }
  if (picked.kind === 'hero') step.value = 'hero'
  else if (picked.kind === 'equipment') step.value = 'piece'
  else emit('close')
}

const take = (one: Found): void => {
  if (!one.hero && !one.equipment) return choose(one.good)
  emit('set', {
    good: one.good.name,
    locked: card.locked,
    bought: false,
    ...(one.hero ? { hero: one.hero } : { equipment: one.equipment }),
  })
  emit('close')
}

const takeOnly = (): void => {
  if (found.value.length === 1) take(found.value[0]!)
}

const empty = (): void => {
  emit('set', { good: null, locked: card.locked, bought: false })
  emit('close')
}

// A bought card keeps no lock.
const toggleBought = (): void => emit('set', { ...card, bought: !card.bought, locked: false })

const name = (named: Pick<ShopCard, 'hero' | 'equipment'>): void => {
  emit('set', { good: card.good, locked: card.locked, bought: card.bought, ...named })
  emit('close')
}
</script>

<template>
  <div v-if="step === 'product'" class="shop-popup products">
    <div class="head">
      <button type="button" class="shop-pill-button" @click="empty">
        {{ i18n.t('app.shop-picker-empty') }}
      </button>
      <button
        v-if="good"
        type="button"
        class="shop-pill-button"
        :aria-pressed="card.bought"
        @click="toggleBought"
      >
        {{ i18n.t('app.shop-picker-bought') }}
      </button>
      <ShopPopupClose @close="emit('close')" />
    </div>
    <PaletteSearch v-model="query" :placeholder="i18n.t('app.shop-search-any')" @enter="takeOnly" />
    <template v-if="searching">
      <div v-if="found.length" class="goods">
        <button
          v-for="one in found"
          :key="one.key"
          type="button"
          class="good"
          :class="{ on: found.length === 1 }"
          @click="take(one)"
        >
          <span class="art">
            <ShopGoodArt :good="one.good" :hero="one.hero" :equipment="one.equipment" icon />
          </span>
          <span class="label">{{ one.label }}</span>
          <ShopBadges class="price" :count="one.good.price" />
        </button>
      </div>
      <p v-else class="shop-no-matches">{{ i18n.t('app.shop-no-matches') }}</p>
    </template>
    <template v-for="group in groups" v-else :key="group.key">
      <p class="group">{{ group.heading }}</p>
      <div class="goods">
        <button
          v-for="one in group.goods"
          :key="one.name"
          type="button"
          class="good"
          :class="{ on: one.name === card.good }"
          :aria-pressed="one.name === card.good"
          @click="choose(one)"
        >
          <span class="art"><ShopGoodArt :good="one" icon /></span>
          <span class="label">{{ rowName(one) }}</span>
          <ShopBadges class="price" :count="one.price" />
        </button>
      </div>
    </template>
  </div>
  <div v-else class="shop-popup">
    <p class="shop-popup-title">
      {{ i18n.t(step === 'hero' ? 'app.shop-picker-which-hero' : 'app.shop-picker-which-piece') }}
      <button type="button" class="shop-pill-button" @click="emit('close')">
        {{ i18n.t('app.shop-picker-skip') }}
      </button>
      <ShopPopupClose @close="emit('close')" />
    </p>
    <CharacterSelectionPalette
      v-if="step === 'hero'"
      :characters="heroes"
      :enter-hint="i18n.t('app.shop-picker-which-hero')"
      @pick="(hero) => name({ hero: hero.name })"
    />
    <ShopEquipmentList v-else :tier="good?.tier" @pick="(piece) => name({ equipment: piece })" />
  </div>
</template>

<style scoped>
.products {
  gap: 4px;
}

.group {
  margin: 4px 2px 0;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.group:first-child {
  margin-top: 0;
}

.goods {
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.good {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 38px;
  padding: 3px 7px 3px 4px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.good:hover {
  background: rgba(255, 255, 255, 0.14);
}

.good.on {
  border-color: var(--color-accent);
}

.art {
  --shop-frame: 2px;
  flex: none;
  display: block;
  width: 30px;
  border-radius: 6px;
}

.label {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.price {
  flex: none;
  font-size: 12px;
  color: var(--color-header-gold);
}

.head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 520px) {
  .goods {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
