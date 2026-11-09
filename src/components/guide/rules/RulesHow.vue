<script setup lang="ts">
/* What the formation engine does, and how to read a rule card, on one of
   Gunnar's rules. */

import { computed } from 'vue'

import RulesCard from './RulesCard.vue'
import SlIcon from '@/components/guide/sl/SlIcon.vue'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { ruleUnitOf, useRulesNames } from './useRules'

const emit = defineEmits<{ open: [list: string] }>()

const { t, proseName, unitName } = useRulesNames()

const sample = ruleUnitOf('gunnar')

// The generator page marks a Generated board with this sparkle.
const intro = computed(() =>
  interpolateParts(t('rules-how-intro'), { sparkle: [{ text: '', marked: true }] }),
)

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
    <p>
      <template v-for="(part, i) in intro" :key="i"
        ><SlIcon v-if="part.marked" name="sparkle" class="inline-icon" /><template v-else>{{
          part.text
        }}</template></template
      >
    </p>
    <p>{{ t('rules-how-best') }}</p>

    <h2>{{ t('rules-how-reading') }}</h2>
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
