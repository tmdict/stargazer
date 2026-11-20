<script setup lang="ts">
/* The two hero lists behind the form's Your heroes button: the heroes sold as
   soon as a pack gives them, and the heroes already at Mythic, which the shop
   no longer gives. A press on a hero puts it on a list or takes it off. */

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import BaseModal from '@/components/modals/BaseModal.vue'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'

const { sell, mythic } = defineProps<{
  show: boolean
  heroes: readonly CharacterType[]
  sell: readonly string[]
  mythic: readonly string[]
}>()

const emit = defineEmits<{ sell: [hero: string]; mythic: [hero: string]; close: [] }>()

const i18n = useI18nStore()

const LISTS = [
  { key: 'sell', head: 'app.shop-sell-head', note: 'app.shop-sell-note' },
  { key: 'mythic', head: 'app.shop-mythic-head', note: 'app.shop-mythic-note' },
] as const

const on = (list: 'sell' | 'mythic', hero: string): boolean =>
  (list === 'sell' ? sell : mythic).includes(hero)

const toggle = (list: 'sell' | 'mythic', hero: string): void =>
  list === 'sell' ? emit('sell', hero) : emit('mythic', hero)
</script>

<template>
  <BaseModal :show :label="i18n.t('app.shop-your-heroes')" @close="emit('close')">
    <template v-for="(list, index) in LISTS" :key="list.key">
      <component :is="index ? 'h2' : 'h1'">{{ i18n.t(list.head) }}</component>
      <p>{{ i18n.t(list.note, { sell: SHOP_FACTS.sell }) }}</p>
      <!-- A popup is dark in both looks, so the list takes the dark colours. -->
      <div class="heroes" data-theme="dark">
        <button
          v-for="hero in heroes"
          :key="hero.name"
          type="button"
          class="hero"
          :class="{ on: on(list.key, hero.name) }"
          :aria-pressed="on(list.key, hero.name)"
          @click="toggle(list.key, hero.name)"
        >
          <GuidePortrait :slug="hero.name" :lang="i18n.currentLocale" :size="44" />
          <span>{{ curatedHeroName(hero.name, i18n.currentLocale) }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.heroes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 10px 4px;
  margin: 12px 0 20px;
}

.hero {
  --disc-ring: var(--color-border-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 6px 2px;
  border: 0;
  border-radius: var(--radius-medium);
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  opacity: 0.7;
}

.hero:hover {
  opacity: 0.9;
}

.hero.on {
  --disc-ring: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-text-primary);
  opacity: 1;
}

.hero span:last-child {
  max-width: 100%;
  overflow-wrap: break-word;
}
</style>
