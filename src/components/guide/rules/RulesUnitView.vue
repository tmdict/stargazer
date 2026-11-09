<script setup lang="ts">
/* A unit's rules: its picture, its name and what kind of unit it is, then a
   card for each rule, those for our team first. */

import { computed } from 'vue'

import RulesCard from './RulesCard.vue'
import GuideDisc from '@/components/guide/GuideDisc.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconGem from '@/components/ui/IconGem.vue'
import { useGameDataStore } from '@/stores/gameData'
import { LEANS, RULE_HEROES, useRulesNames, type RulesUnit } from './useRules'

const { unit } = defineProps<{ unit: RulesUnit; openList: string | null }>()

const emit = defineEmits<{ open: [list: string] }>()

const gameData = useGameDataStore()
const { lang, t, game, heroName, proseName, unitName, unitSub } = useRulesNames()

const hero = computed(() =>
  unit.kind === 'hero' ? RULE_HEROES.find((h) => h.name === unit.id) : undefined,
)
const lean = computed(() => {
  const id = hero.value?.id
  if (id === undefined) return null
  return LEANS.front.has(id) ? 'front' : LEANS.back.has(id) ? 'back' : 'none'
})
const picture = computed(() => {
  if (unit.kind === 'phantimal') return gameData.getCharacterImage(unit.id)
  if (unit.kind === 'artifact') return gameData.getArtifactImage(unit.id)
  return null
})
</script>

<template>
  <section class="rules-view">
    <header class="unit-head">
      <GuidePortrait v-if="hero" :slug="hero.name" :lang :size="56" />
      <GuideDisc v-else :size="56" class="mark">
        <img v-if="picture" :src="picture" alt="" />
        <IconGem v-else :size="30" />
      </GuideDisc>
      <div>
        <h2>{{ unitName(unit) }}</h2>
        <p v-if="hero" class="meta reading-meta">
          <span
            ><img :src="gameData.getIcon(`class-${hero.class}`)" alt="" />{{
              game(hero.class)
            }}</span
          >
          <span
            ><img :src="gameData.getIcon(`faction-${hero.faction}`)" alt="" />{{
              game(hero.faction)
            }}</span
          >
          <span v-if="lean">{{ t(`rules-lean-${lean}`) }}</span>
        </p>
        <p v-else-if="unit.kind === 'charm'" class="meta reading-meta">
          <span>{{ t('rules-held-by') }}</span>
          <span v-for="slug in unit.holders" :key="slug" class="holder">
            <GuidePortrait :slug :lang :size="20" />{{ heroName(slug) }}
          </span>
        </p>
        <p v-else class="meta reading-meta">{{ unitSub(unit) }}</p>
      </div>
    </header>
    <RulesCard
      v-for="(card, index) in unit.cards"
      :key="index"
      :card
      :who="proseName(unitName(unit))"
      :open-list
      @open="emit('open', $event)"
    />
  </section>
</template>

<style scoped>
.unit-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.unit-head h2 {
  margin: 0;
}

.mark {
  color: var(--color-header-gold);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin: 4px 0 0;
}

.meta span {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.meta img {
  width: 16px;
  height: 16px;
  margin-right: 4px;
}

.holder {
  gap: 5px;
}
</style>
