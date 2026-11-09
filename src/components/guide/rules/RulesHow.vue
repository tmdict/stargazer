<script setup lang="ts">
/* How a formation is picked, and how to read a rule card, on one of Gunnar's
   rules. */

import { computed } from 'vue'

import RulesCard from './RulesCard.vue'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { ruleUnitOf, useRulesNames } from './useRules'

const emit = defineEmits<{ open: [list: string] }>()

const { t, proseName, unitName } = useRulesNames()

const sample = ruleUnitOf('gunnar')

const bold = (key: string): TextPart[] => [{ text: t(key), marked: true }]
const KEYS = ['effect', 'list', 'use', 'enemy', 'tile', 'weight']
const keys = computed(() =>
  KEYS.map((key) =>
    interpolateParts(t(`rules-how-key-${key}`), {
      list: bold('rules-row-list'),
      goes: bold('rules-row-goes-to'),
      counts: bold('rules-row-counts'),
      targets: bold('rules-row-targets'),
      keep: bold('rules-row-keep-away'),
      tile: bold('rules-row-tile'),
      weight: bold('rules-row-weight'),
    }),
  ),
)
</script>

<template>
  <section class="rules-view">
    <h2>{{ t('rules-how') }}</h2>
    <p>{{ t('rules-how-intro') }}</p>
    <p>{{ t('rules-how-steps') }}</p>
    <ol class="steps">
      <li v-for="step in [1, 2]" :key="step" class="rules-box">
        <span class="number">{{ step }}</span>
        <div>
          <p class="step">{{ t(`rules-how-step-${step}-title`) }}</p>
          <p class="reading-secondary">{{ t(`rules-how-step-${step}`) }}</p>
        </div>
      </li>
    </ol>
    <p>{{ t('rules-how-also-fine') }}</p>

    <h3>{{ t('rules-how-reading') }}</h3>
    <RulesCard
      v-if="sample"
      :card="sample.cards[0]!"
      :who="proseName(unitName(sample))"
      :open-list="null"
      @open="emit('open', $event)"
    />
    <p class="legend reading-meta" data-theme="dark">
      <span><i class="swatch ally" />{{ t('rules-on-ours') }}</span>
      <span><i class="swatch enemy" />{{ t('rules-on-theirs') }}</span>
    </p>
    <ul class="reading-secondary">
      <li v-for="(parts, index) in keys" :key="index">
        <template v-for="(part, i) in parts" :key="i"
          ><strong v-if="part.marked">{{ part.text }}</strong
          ><template v-else>{{ part.text }}</template></template
        >
      </li>
    </ul>
  </section>
</template>

<style scoped>
.steps {
  display: grid;
  gap: 8px;
  margin: 12px 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: flex;
  gap: 12px;
  margin: 0;
  opacity: 1;
}

.steps p {
  margin: 0;
}

.number {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  font-family: var(--font-ui);
  font-weight: 700;
  color: #fff;
}

.step {
  font-weight: 600;
}

.legend {
  display: flex;
  margin-top: -4px;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  display: inline-block;
  width: 14px;
  height: 4px;
  border-radius: 2px;
}

.swatch.ally {
  background: var(--unit-frame-ally);
}

.swatch.enemy {
  background: var(--unit-frame-enemy);
}
</style>
