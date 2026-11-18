<script setup lang="ts">
/* One of the shop probability guide's tables, the same in every language:
   what each round brings, how often each product shows, how often one hero
   shows, what a pack gives, and the records behind each shop level. */

import { useI18nStore } from '@/stores/i18n'
import { goodName } from './shopGoods'
import { percent, useShopFigures } from './useShopFigures'

defineProps<{ table: 'rounds' | 'levels' | 'products' | 'hero' | 'packs' }>()

const i18n = useI18nStore()
const figures = useShopFigures()
const level = (n: number): string => i18n.t('app.shop-level-short', { level: n })
</script>

<template>
  <div class="scroll">
    <table v-if="table === 'rounds'" class="guide-table">
      <thead>
        <tr>
          <th scope="col">{{ i18n.t('app.shop-math-round') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-badges-gained') }}</th>
          <th scope="col">{{ i18n.t('app.shop-level-label') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-event') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in figures.rounds" :key="row.round">
          <th scope="row">{{ row.round }}</th>
          <td>{{ row.badges }}</td>
          <td>{{ level(row.level) }}</td>
          <td>{{ row.event ? i18n.t(`app.shop-event-${row.event}`) : '' }}</td>
        </tr>
      </tbody>
    </table>

    <table v-else-if="table === 'levels'" class="guide-table">
      <thead>
        <tr>
          <th scope="col">{{ i18n.t('app.shop-level-label') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-rounds') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-records') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in figures.levels" :key="row.level">
          <th scope="row">{{ row.level }}</th>
          <td>{{ row.rounds }}</td>
          <td>{{ row.records?.toLocaleString('en') ?? '–' }}</td>
        </tr>
      </tbody>
    </table>

    <table v-else-if="table === 'products'" class="guide-table">
      <thead>
        <tr>
          <th scope="col" class="name">{{ i18n.t('app.shop-math-product') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-price') }}</th>
          <th v-for="row in figures.levels" :key="row.level" scope="col">{{ level(row.level) }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in figures.products" :key="row.name">
          <th scope="row" class="name">{{ goodName(row.name, i18n.currentLocale) }}</th>
          <td>{{ row.price }}</td>
          <td v-for="(chance, index) in row.chances" :key="index" :class="{ none: !chance }">
            {{ percent(chance) }}
          </td>
        </tr>
      </tbody>
    </table>

    <table v-else-if="table === 'hero'" class="guide-table">
      <thead>
        <tr>
          <th scope="col">{{ i18n.t('app.shop-level-label') }}</th>
          <th scope="col">{{ goodName(figures.heroCard, i18n.currentLocale) }}</th>
          <th scope="col">{{ goodName(figures.pairCard, i18n.currentLocale) }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-shows') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-rerolls') }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-reroll-badges') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in figures.hero.value" :key="row.level">
          <th scope="row">{{ row.level }}</th>
          <td :class="{ none: !row.single }">{{ percent(row.single) }}</td>
          <td :class="{ none: !row.pair }">{{ percent(row.pair) }}</td>
          <td :class="{ none: !row.chance }">{{ percent(row.chance) }}</td>
          <td :class="{ none: !row.rerolls }">{{ row.rerolls?.toFixed(1) ?? '–' }}</td>
          <td :class="{ none: !row.rerolls }">
            {{ row.rerolls ? Math.round(row.rerolls * figures.reroll) : '–' }}
          </td>
        </tr>
      </tbody>
    </table>

    <table v-else class="guide-table">
      <thead>
        <tr>
          <th scope="col">{{ i18n.t('app.shop-math-wanted') }}</th>
          <th scope="col">{{ goodName(figures.randomPack, i18n.currentLocale) }}</th>
          <th scope="col">{{ i18n.t('app.shop-math-faction-pack') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in figures.packs.value" :key="row.wanted">
          <th scope="row">{{ row.wanted }}</th>
          <td>{{ percent(row.random) }}</td>
          <td>{{ percent(row.faction) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.scroll {
  margin: 12px 0 16px;
  overflow-x: auto;
}
.guide-table {
  max-width: 720px;
}
.guide-table .name {
  text-align: left;
  white-space: nowrap;
}
.guide-table tbody th {
  color: var(--reading-muted);
}
.guide-table .none {
  color: var(--reading-muted);
}
</style>
