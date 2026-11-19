<script setup lang="ts">
/* A product's picture as a square: the hero or piece a card names, else the
   game's question-mark card, with a chip for what it gives, a faction pack's
   faction in the corner, and a frame in its tier's colour. A hero card of
   two copies shows its picture twice, overlapped and tilted, as the game's
   card does.
   Without the data pack's pictures a plain mark stands in. As a list's
   icon it is told apart by the picture alone: a faction pack is its faction,
   an equipment card a piece of its tier, and the chip is left out. */

import { computed } from 'vue'

import { duelEquipment, duelItemImage } from '@/lib/hd/catalog'
import type { Good } from '@/lib/hd/shop/types'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { goodTier, shopPicture } from './shopGoods'

const { good, hero, equipment, icon } = defineProps<{
  good: Good
  hero?: string
  equipment?: string
  icon?: boolean
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

const picture = computed((): { src: string; fit: 'portrait' | 'raised' | 'plain' } | null => {
  if (good.kind === 'hero' && hero) {
    return { src: gameData.getCharacterImage(hero), fit: 'portrait' }
  }
  if (icon && good.faction) {
    return { src: gameData.getIcon(`faction-${good.faction}`), fit: 'plain' }
  }
  if (good.kind === 'equipment' && (equipment || icon)) {
    const item = duelEquipment.find((piece) =>
      equipment ? piece.name === equipment : piece.shop && piece.tier === good.tier,
    )
    const src = item && duelItemImage({ kind: 'equipment', item })
    if (src) return { src, fit: 'plain' }
  }
  const src = shopPicture(good.kind === 'exp' ? 'artifact-exp' : 'random-card')
  if (!src) return null
  return { src, fit: good.kind === 'pack' || good.kind === 'legendary' ? 'raised' : 'plain' }
})

const pair = computed(() => good.kind === 'hero' && good.copies === 2)

const chip = computed(() => {
  if (icon || pair.value) return null
  if (good.kind === 'trial') return i18n.t('app.trial')
  return (good.copies ?? 1) > 1 ? `×${good.copies}` : null
})

const tier = computed(() => goodTier(good))
const faction = computed(() => !icon && good.faction && gameData.getIcon(`faction-${good.faction}`))
</script>

<template>
  <span class="shop-art" :class="[tier && `shop-tier-${tier}`, { pair }]">
    <template v-if="picture">
      <img
        v-for="copy in pair ? 2 : 1"
        :key="copy"
        class="picture"
        :class="picture.fit"
        :src="picture.src"
        alt=""
        draggable="false"
      />
    </template>
    <span v-else class="mark">{{ good.kind === 'exp' ? 'XP' : '?' }}</span>
    <span v-if="chip" class="chip">{{ chip }}</span>
    <img v-if="faction" class="faction" :src="faction" alt="" draggable="false" />
  </span>
</template>

<style scoped>
.shop-art {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  border-radius: inherit;
  background: rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.shop-art[class*='shop-tier-']::after {
  content: '';
  position: absolute;
  inset: 0;
  border: var(--shop-frame, 3px) solid var(--shop-tier);
  border-radius: inherit;
  pointer-events: none;
}

.picture {
  max-width: 78%;
  max-height: 86%;
  object-fit: contain;
}

.picture.raised {
  translate: 0 -6%;
}

.picture.portrait {
  position: absolute;
  inset: 0;
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 28%;
}

.pair .picture {
  position: absolute;
  inset: 8% auto auto 8%;
  width: 56%;
  height: 68%;
  max-width: none;
  max-height: none;
  rotate: -6deg;
}

.pair .picture + .picture {
  inset: auto 10.5% 9.5% auto;
  rotate: 14deg;
}

.pair .picture.portrait {
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 12%;
  background: #2f3540;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
}

.mark {
  font-size: 1.6em;
  font-weight: 700;
  color: var(--import-text-dim);
}

.chip {
  position: absolute;
  left: 4px;
  top: 4px;
  padding: 0 6px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.faction {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 30%;
  max-width: 30px;
  aspect-ratio: 1;
}
</style>
