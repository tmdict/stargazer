<script setup lang="ts">
/* Every hero's lean, a class to a panel. */

import { computed } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import { CLASS_ORDER } from '@/lib/filterOrder'
import { useGameDataStore } from '@/stores/gameData'
import { leanOf, RULE_HEROES, useRulesNames } from './useRules'

const gameData = useGameDataStore()
const { lang, t, game, heroName } = useRulesNames()

const LEAN_ORDER = ['front', 'back', 'none'] as const

const classes = computed(() =>
  CLASS_ORDER.map((key) => {
    const heroes = RULE_HEROES.filter((hero) => hero.class === key)
    return {
      key,
      groups: LEAN_ORDER.map((lean) => ({
        lean,
        heroes: heroes.filter((hero) => leanOf(hero.id) === lean).map((hero) => hero.name),
      })).filter((group) => group.heroes.length),
    }
  }).filter((group) => group.groups.length),
)
</script>

<template>
  <section class="rules-view">
    <h2>{{ t('rules-leans') }}</h2>
    <p>{{ t('rules-leans-intro') }}</p>
    <div v-for="item in classes" :key="item.key" class="rules-box">
      <h3 class="class">
        <img :src="gameData.getIcon(`class-${item.key}`)" alt="" />{{ game(item.key) }}
      </h3>
      <template v-for="group in item.groups" :key="group.lean">
        <p class="rules-group">{{ t(`rules-lean-${group.lean}`) }} · {{ group.heroes.length }}</p>
        <div class="rules-heroes">
          <span v-for="slug in group.heroes" :key="slug" class="rules-hero">
            <GuidePortrait :slug :lang :size="22" />{{ heroName(slug) }}
          </span>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.class {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
}

.class img {
  width: 20px;
  height: 20px;
}
</style>
