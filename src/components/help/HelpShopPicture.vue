<script setup lang="ts">
/* The shop calculator's picture: a shop of eight cards with one hero looked
   for, and that hero's answer card. Drawn by hand, since the page's own cards
   bring the mode's whole catalog with them. */

import { computed } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import IconLock from '@/components/ui/IconLock.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { useGameDataStore } from '@/stores/gameData'
import { interpolate } from '@/utils/interpolate'
import { goodName } from '@/utils/shopGoodNames'
import { appLabel, curatedHeroName } from '@/utils/skillLabels'

const lang = useHelpLocale()
const label = (key: string): string => appLabel(key, lang.value)
const gameData = useGameDataStore()

const WANTED = 'valen'

// A card names a hero, or shows the game's question mark or the artifact's XP.
const CARDS: readonly { hero?: string; mark?: string; price: number; locked?: boolean }[] = [
  { mark: '?', price: 33 },
  { hero: 'cecia', price: 15 },
  { mark: 'XP', price: 15 },
  { mark: '?', price: 18 },
  { mark: '?', price: 18 },
  { hero: 'thoran', price: 15, locked: true },
  { mark: '?', price: 6 },
  { mark: '?', price: 33 },
]

const PACK = 'lightbearer-pack'
const PACK_PRICE = 33
const REROLL_PRICE = 3

const heroName = computed(() => curatedHeroName(WANTED, lang.value))
const buy = computed(() =>
  interpolate(label('shop-step-buy'), { item: goodName(PACK, lang.value) }),
)
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('shop-window')" data-theme="dark">
        <div class="help-shop-cards">
          <span
            v-for="(card, index) in CARDS"
            :key="index"
            class="help-shop-card"
            :class="{ locked: card.locked }"
          >
            <span class="help-shop-art">
              <img v-if="card.hero" :src="gameData.getCharacterImage(card.hero)" alt="" />
              <template v-else>{{ card.mark }}</template>
            </span>
            <span class="help-shop-price"><i class="help-shop-coin" />{{ card.price }}</span>
            <span class="help-shop-lock"><IconLock :open="!card.locked" /></span>
          </span>
        </div>
        <div class="help-shop-want">
          <span class="help-shop-label">{{ label('shop-looking-for') }}</span>
          <span class="help-shop-chip">
            <GuidePortrait :slug="WANTED" :lang :size="22" />{{ heroName }} ×1
          </span>
        </div>
        <div class="help-shop-go">
          <span class="solid-btn help-sl-action">{{ label('shop-calculate') }}</span>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('shop-answers-head')" data-theme="dark">
        <div class="help-shop-head">
          <GuidePortrait :slug="WANTED" :lang :size="34" />
          <b>{{ heroName }}</b>
        </div>
        <div class="help-shop-part">
          <span class="help-shop-label accent">{{ label('shop-best-chance') }}</span>
          <span class="help-shop-figure"><b>39.1%</b> {{ label('shop-this-round') }}</span>
          <span class="help-shop-step">
            {{ buy }}
            <span class="help-shop-price"><i class="help-shop-coin" />{{ PACK_PRICE }}</span>
          </span>
        </div>
        <div class="help-shop-part">
          <span class="help-shop-label accent">{{ label('shop-fewest-badges') }}</span>
          <span class="help-shop-figure"><b>48.6</b> {{ label('shop-on-average') }}</span>
          <span class="help-shop-step">
            {{ label('shop-reroll') }}
            <span class="help-shop-price"><i class="help-shop-coin" />{{ REROLL_PRICE }}</span>
          </span>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.help-shop-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  max-width: 250px;
  margin: 0 auto 12px;
}

.help-shop-card {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 5px 4px 4px;
  border: 1.5px solid transparent;
  border-radius: 6px;
  background: var(--import-surface);
}

.help-shop-card.locked {
  border-color: var(--color-header-gold);
}

.help-shop-art {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--import-surface);
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--color-header-gold);
}

.help-shop-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.help-shop-price {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-header-gold);
}

.help-shop-coin {
  width: 0.6em;
  height: 0.6em;
  border-radius: 50%;
  background: var(--color-header-gold);
}

.help-shop-lock {
  position: absolute;
  top: -5px;
  right: -5px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--import-border-strong);
  border-radius: 50%;
  background: var(--color-bg-primary);
  font-size: 9px;
  color: var(--color-text-secondary);
}

.locked .help-shop-lock {
  border-color: var(--color-header-gold);
  color: var(--color-header-gold);
}

.help-shop-want {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.help-shop-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.help-shop-label.accent {
  color: var(--color-primary);
}

.help-shop-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px 2px 3px;
  border: 1px solid var(--import-border);
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.help-shop-go {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.help-shop-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  font-size: 0.95rem;
}

.help-shop-part {
  display: grid;
  justify-items: start;
  gap: 4px;
  padding: 9px 0;
  border-top: 1px solid var(--color-border-light);
}

.help-shop-figure {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.help-shop-figure b {
  margin-right: 2px;
  font-size: 1.15rem;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}

.help-shop-step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid var(--import-border);
  border-radius: 999px;
  background: var(--import-surface);
  font-size: 0.78rem;
  font-weight: 600;
}
</style>
